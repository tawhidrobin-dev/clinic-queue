"""
FastAPI Implementation for:
POST /api/sessions/{session_id}/next-patient

Dependencies:
    pip install fastapi uvicorn sqlalchemy asyncpg pydantic
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy import select, update, desc, asc, and_
from sqlalchemy.ext.asyncio import AsyncSession

# Weight multipliers per appointment type
APPOINTMENT_TYPE_WEIGHTS = {
    "NEW_PATIENT": 1.3,
    "REPORT_CHECK": 0.7,
    "FOLLOW_UP": 1.0,
    "EMERGENCY": 1.6,
}
MOVING_AVERAGE_WINDOW = 10
MIN_CONSULTATION_MINS = 2

router = APIRouter(prefix="/api/sessions", tags=["Queue Management"])


# --- Pydantic Schemas ---

class PatientSummary(BaseModel):
    id: UUID
    serial_number: int
    appointment_type: Optional[str]
    status: str
    consultation_start_time: Optional[datetime] = None
    actual_duration_mins: Optional[int] = None
    estimated_consult_time: Optional[datetime] = None
    estimated_duration_mins: Optional[int] = None

class NextPatientResponse(BaseModel):
    success: bool
    message: str
    session_id: UUID
    session_status: str
    current_serving_serial: int
    moving_average_mins: float
    completed_patient: Optional[PatientSummary] = None
    current_patient: Optional[PatientSummary] = None
    waiting_patients: List[PatientSummary]


# --- Database Helper Functions ---

async def get_moving_average_mins(
    db: AsyncSession,
    session_id: UUID,
    doctor_baseline_mins: int = 10
) -> float:
    """Computes moving average duration of recent completed appointments in session."""
    # Assuming SQLAlchemy models: Appointment
    from models import Appointment  # Replace with your actual model import

    query = (
        select(Appointment.actual_duration_mins)
        .where(
            and_(
                Appointment.session_id == session_id,
                Appointment.status == "COMPLETED",
                Appointment.actual_duration_mins.isnot(None),
                Appointment.actual_duration_mins > 0,
            )
        )
        .order_by(desc(Appointment.consultation_end_time), desc(Appointment.serial_number))
        .limit(MOVING_AVERAGE_WINDOW)
    )
    result = await db.execute(query)
    durations = [row[0] for row in result.fetchall() if row[0] is not None]

    if not durations:
        return float(max(MIN_CONSULTATION_MINS, doctor_baseline_mins))

    avg = sum(durations) / len(durations)
    return round(max(MIN_CONSULTATION_MINS, avg), 1)


# --- Endpoint ---

@router.post(
    "/{session_id}/next-patient",
    response_model=NextPatientResponse,
    status_code=status.HTTP_200_OK,
    summary="Advance Queue to Next Patient",
    description=(
        "Completes the active in-consultation patient, computes moving average consultation "
        "duration for the session, advances next patient to in-consultation, applies appointment type "
        "weights to forecast waiting patients' estimated consult times, and commits changes atomically."
    )
)
async def next_patient(
    session_id: UUID,
    # Inject your async database session here:
    # db: AsyncSession = Depends(get_db_session)
):
    """
    Implementation logic using SQLAlchemy async session:
    """
    from database import get_db_session  # Placeholder for your db dependency
    from models import Session, Chamber, DoctorProfile, Appointment  # Models

    async with db.begin():  # Atomically wrapped transaction
        now = datetime.now(timezone.utc)

        # 1. Fetch Session and Doctor baseline
        session_query = (
            select(Session, DoctorProfile.avg_consultation_mins)
            .join(Chamber, Session.chamber_id == Chamber.id, isouter=True)
            .join(DoctorProfile, Chamber.doctor_id == DoctorProfile.id, isouter=True)
            .where(Session.id == session_id)
        )
        session_res = (await db.execute(session_query)).first()
        if not session_res:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        session_obj, doctor_avg = session_res
        if session_obj.status in ["CANCELLED", "COMPLETED"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot advance queue for session in {session_obj.status} status"
            )

        doctor_baseline = doctor_avg or 10

        # 2. Finish current IN_CONSULTATION appointment if exists
        active_query = (
            select(Appointment)
            .where(
                and_(
                    Appointment.session_id == session_id,
                    Appointment.status == "IN_CONSULTATION"
                )
            )
        )
        active_patient = (await db.execute(active_query)).scalar_one_or_none()
        completed_patient_data = None

        if active_patient:
            start = active_patient.consultation_start_time or now
            duration_mins = max(1, int((now - start).total_seconds() / 60))
            active_patient.status = "COMPLETED"
            active_patient.consultation_end_time = now
            active_patient.actual_duration_mins = duration_mins

            completed_patient_data = PatientSummary(
                id=active_patient.id,
                serial_number=active_patient.serial_number,
                appointment_type=active_patient.appointment_type,
                status="COMPLETED",
                actual_duration_mins=duration_mins
            )

        # 3. Find next waiting patient
        waiting_query = (
            select(Appointment)
            .where(
                and_(
                    Appointment.session_id == session_id,
                    Appointment.status.in_(["WAITING", "BOOKED"])
                )
            )
            .order_by(asc(Appointment.serial_number))
        )
        waiting_list = (await db.execute(waiting_query)).scalars().all()

        next_patient = None
        remaining_waiting = []
        if waiting_list:
            next_patient = waiting_list[0]
            remaining_waiting = waiting_list[1:]

            next_patient.status = "IN_CONSULTATION"
            next_patient.consultation_start_time = now
            next_patient.estimated_consult_time = now

            session_obj.current_serving_serial = next_patient.serial_number

        if session_obj.status == "SCHEDULED":
            session_obj.status = "ACTIVE"
            session_obj.actual_start_time = now

        # 4. Compute moving average with newly completed patient included
        moving_avg = await get_moving_average_mins(db, session_id, doctor_baseline)

        # 5. Forecast waiting times using weights
        curr_est_duration = 0
        if next_patient:
            weight = APPOINTMENT_TYPE_WEIGHTS.get(next_patient.appointment_type, 1.0)
            curr_est_duration = max(MIN_CONSULTATION_MINS, int(round(moving_avg * weight)))

        next_available_ts = now.timestamp() + (curr_est_duration * 60)

        updated_waiting_summaries = []
        for patient in remaining_waiting:
            weight = APPOINTMENT_TYPE_WEIGHTS.get(patient.appointment_type, 1.0)
            patient_duration = max(MIN_CONSULTATION_MINS, int(round(moving_avg * weight)))

            patient_est_time = datetime.fromtimestamp(next_available_ts, tz=timezone.utc)
            patient.estimated_consult_time = patient_est_time
            next_available_ts += (patient_duration * 60)

            updated_waiting_summaries.append(
                PatientSummary(
                    id=patient.id,
                    serial_number=patient.serial_number,
                    appointment_type=patient.appointment_type,
                    status=patient.status,
                    estimated_consult_time=patient_est_time,
                    estimated_duration_mins=patient_duration
                )
            )

        current_summary = None
        if next_patient:
            current_summary = PatientSummary(
                id=next_patient.id,
                serial_number=next_patient.serial_number,
                appointment_type=next_patient.appointment_type,
                status="IN_CONSULTATION",
                consultation_start_time=now
            )

        return NextPatientResponse(
            success=True,
            message=(
                f"Now serving serial #{next_patient.serial_number}"
                if next_patient else "No more waiting patients"
            ),
            session_id=session_id,
            session_status=session_obj.status,
            current_serving_serial=session_obj.current_serving_serial or 0,
            moving_average_mins=moving_avg,
            completed_patient=completed_patient_data,
            current_patient=current_summary,
            waiting_patients=updated_waiting_summaries
        )
