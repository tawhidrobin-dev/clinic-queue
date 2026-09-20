import { db } from '@/src/db';
import {
  users,
  doctorProfiles,
  chambers,
  sessions,
  patients,
  appointments,
} from '@/src/db/schema';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

async function seed() {
  console.log('🌱 Starting database seeding for Clinic Queue App...');

  try {
    // 1. Create Doctor User
    const [doctorUser] = await db
      .insert(users)
      .values({
        fullName: 'Prof. Dr. M. A. Rahman',
        phoneNumber: '+8801711000001',
        email: 'dr.rahman@clinic.com',
        role: 'DOCTOR',
      })
      .onConflictDoUpdate({
        target: users.phoneNumber,
        set: { fullName: 'Prof. Dr. M. A. Rahman' },
      })
      .returning();

    console.log(`✅ Doctor user ready: ${doctorUser.fullName} (${doctorUser.id})`);

    // 2. Create Doctor Profile
    const [profile] = await db
      .insert(doctorProfiles)
      .values({
        userId: doctorUser.id,
        specialty: 'Cardiology & Internal Medicine',
        qualifications: 'MBBS, FCPS (Medicine), MD (Cardiology)',
        avgConsultationMins: 12,
      })
      .onConflictDoUpdate({
        target: doctorProfiles.userId,
        set: { avgConsultationMins: 12 },
      })
      .returning();

    console.log(`✅ Doctor profile ready: ${profile.specialty}`);

    // 3. Create Chamber Location
    const [chamber] = await db
      .insert(chambers)
      .values({
        doctorId: profile.id,
        chamberName: 'Popular Diagnostic Centre, Dhanmondi',
        area: 'Dhanmondi, Dhaka',
        address: 'House 16, Road 2, Dhanmondi R/A, Room #408',
      })
      .returning();

    console.log(`✅ Chamber created: ${chamber.chamberName}`);

    // 4. Create Today's Session
    const today = new Date().toISOString().split('T')[0];
    const [session] = await db
      .insert(sessions)
      .values({
        chamberId: chamber.id,
        scheduledDate: today,
        scheduledStartTime: '17:00:00',
        status: 'SCHEDULED',
        currentServingSerial: 0,
      })
      .returning();

    console.log(`✅ Session created: ${session.id} (Date: ${session.scheduledDate})`);

    // 5. Create Sample Patients
    const patientData = [
      {
        fullName: 'Tanvir Hossain',
        phoneNumber: '+8801712345671',
        age: 38,
        gender: 'Male',
        preferredTransport: 'CAR',
        homeLatitude: '23.7508',
        homeLongitude: '90.3934',
      },
      {
        fullName: 'Nusrat Jahan',
        phoneNumber: '+8801712345672',
        age: 29,
        gender: 'Female',
        preferredTransport: 'CNG',
        homeLatitude: '23.7925',
        homeLongitude: '90.4078',
      },
      {
        fullName: 'Abdul Karim',
        phoneNumber: '+8801712345673',
        age: 62,
        gender: 'Male',
        preferredTransport: 'CAR',
        homeLatitude: '23.8103',
        homeLongitude: '90.4125',
      },
      {
        fullName: 'Shamima Akter',
        phoneNumber: '+8801712345674',
        age: 44,
        gender: 'Female',
        preferredTransport: 'BIKE',
        homeLatitude: '23.7380',
        homeLongitude: '90.3850',
      },
    ];

    const insertedPatients = await db.insert(patients).values(patientData).returning();
    console.log(`✅ Created ${insertedPatients.length} sample patients`);

    // 6. Create Queue Appointments
    const appointmentConfigs = [
      {
        type: 'NEW_PATIENT' as const,
        serial: 1,
        estTravel: 25,
      },
      {
        type: 'FOLLOW_UP' as const,
        serial: 2,
        estTravel: 35,
      },
      {
        type: 'REPORT_CHECK' as const,
        serial: 3,
        estTravel: 20,
      },
      {
        type: 'NEW_PATIENT' as const,
        serial: 4,
        estTravel: 45,
      },
    ];

    const now = new Date();
    const createdAppointments = [];

    for (let i = 0; i < insertedPatients.length; i++) {
      const p = insertedPatients[i];
      const cfg = appointmentConfigs[i];
      const token = crypto.randomBytes(16).toString('hex');
      const estTime = new Date(now.getTime() + (i * 12 + 10) * 60 * 1000);
      const leaveTime = new Date(estTime.getTime() - cfg.estTravel * 60 * 1000);

      const [appt] = await db
        .insert(appointments)
        .values({
          sessionId: session.id,
          patientId: p.id,
          serialNumber: cfg.serial,
          appointmentType: cfg.type,
          status: 'WAITING',
          trackingToken: token,
          estimatedConsultTime: estTime,
          estimatedTravelMins: cfg.estTravel,
          recommendedLeaveTime: leaveTime,
        })
        .returning();

      createdAppointments.push(appt);
    }

    console.log(`✅ Seeded ${createdAppointments.length} queue appointments!`);

    console.log('\n======================================================');
    console.log('🎉 DEMO ENVIRONMENT READY FOR TESTING');
    console.log('======================================================');
    console.log(`Doctor Control Center URL:`);
    console.log(`👉 http://localhost:3000/dashboard/sessions/${session.id}`);
    console.log('\nPatient Live Tracking URLs:');
    createdAppointments.forEach((a, idx) => {
      console.log(`👉 Serial #${a.serialNumber} (${insertedPatients[idx].fullName}): http://localhost:3000/track/${a.trackingToken}`);
    });
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
