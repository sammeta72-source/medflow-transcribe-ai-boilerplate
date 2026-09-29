// MedFlow Transcribe AI — Seed Script
// Creates a single demo organization "Cardinal Health Systems" with synthetic
// (NON-PHI) sample data: users, providers, facilities, specialties, templates,
// transcription jobs in various workflow states, clarifications, audit events,
// subscription, usage, integrations, delivery destinations, notifications.
//
// Run: bun run prisma/seed.ts

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

const now = new Date()
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000)
const hoursAhead = (h: number) => new Date(now.getTime() + h * 3600 * 1000)
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400 * 1000)

async function main() {
  console.log('🌱 Seeding MedFlow Transcribe AI demo data...')

  // ── Organization ─────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'cardinal-health' },
    update: {},
    create: {
      name: 'Cardinal Health Systems',
      slug: 'cardinal-health',
      country: 'United States',
      timezone: 'America/New_York',
      planTier: 'Professional',
      status: 'active',
      trialEndsAt: hoursAhead(24 * 7),
    },
  })
  console.log('  ✓ Organization', org.slug)

  // ── Data Retention Policy ────────────────────────────────────────────────
  await prisma.dataRetentionPolicy.upsert({
    where: { organizationId: org.id },
    update: {},
    create: { organizationId: org.id },
  })

  // ── Facilities ────────────────────────────────────────────────────────────
  const facilities = await Promise.all([
    prisma.facility.create({ data: { organizationId: org.id, name: 'Cardinal Main Hospital', code: 'CMH-01', timezone: 'America/New_York' } }),
    prisma.facility.create({ data: { organizationId: org.id, name: 'Cardinal West Clinic', code: 'CWC-02', timezone: 'America/Los_Angeles' } }),
    prisma.facility.create({ data: { organizationId: org.id, name: 'Cardinal East Surgery Center', code: 'CESC-03', timezone: 'America/New_York' } }),
  ])

  // ── Departments ──────────────────────────────────────────────────────────
  const departments = await Promise.all(
    ['Cardiology', 'Orthopedics', 'Radiology', 'Emergency', 'Internal Medicine', 'Surgery']
      .map(name => prisma.department.create({ data: { organizationId: org.id, name } }))
  )

  // ── Specialties ───────────────────────────────────────────────────────────
  const specialties = await Promise.all(
    ['Cardiology', 'Orthopedics', 'Radiology', 'Emergency Medicine', 'Internal Medicine', 'General Surgery', 'Pediatrics', 'Oncology']
      .map(name => prisma.specialty.create({ data: { organizationId: org.id, name } }))
  )

  // ── Users (multi-role) ────────────────────────────────────────────────────
  type U = { id: string; name: string; email: string; role: string }
  const userDefs: U[] = [
    { id: 'u_admin',   name: 'Dana Whitfield',    email: 'dana.whitfield@cardinalhealth.demo',    role: 'Tenant Owner' },
    { id: 'u_ops',     name: 'Marcus Reyes',        email: 'marcus.reyes@cardinalhealth.demo',     role: 'Client Operations Manager' },
    { id: 'u_coord',  name: 'Aisha Patel',          email: 'aisha.patel@cardinalhealth.demo',     role: 'Onsite Coordinator' },
    { id: 'u_dlvm',    name: 'Vikram Sundaram',     email: 'vikram.sundaram@cardinalhealth.demo',  role: 'Offshore Delivery Manager' },
    { id: 'u_prov',    name: 'Dr. Emily Carter',    email: 'emily.carter@cardinalhealth.demo',    role: 'Provider' },
    { id: 'u_prov2',   name: 'Dr. James Okafor',    email: 'james.okafor@cardinalhealth.demo',    role: 'Provider' },
    { id: 'u_ts1',     name: 'Priya Nair',           email: 'priya.nair@offshore.medflow.demo',    role: 'Transcriptionist' },
    { id: 'u_ts2',     name: 'Diego Martinez',       email: 'diego.martinez@offshore.medflow.demo',role: 'Transcriptionist' },
    { id: 'u_ed1',     name: 'Sara Lin',             email: 'sara.lin@offshore.medflow.demo',      role: 'Medical Editor' },
    { id: 'u_ed2',     name: 'Tom Becker',           email: 'tom.becker@offshore.medflow.demo',    role: 'Medical Editor' },
    { id: 'u_qa1',     name: 'Ananya Iyer',          email: 'ananya.iyer@offshore.medflow.demo',   role: 'QA Analyst' },
    { id: 'u_qa2',     name: 'Robert Chen',          email: 'robert.chen@offshore.medflow.demo',   role: 'QA Analyst' },
    { id: 'u_bill',    name: 'Linda Hoffmann',       email: 'linda.hoffmann@cardinalhealth.demo', role: 'Billing User' },
    { id: 'u_aud',     name: 'Henry Donovan',        email: 'henry.donovan@cardinalhealth.demo',   role: 'Auditor / Compliance Officer' },
  ]
  const users = await Promise.all(
    userDefs.map(u => prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, organizationId: org.id, status: 'active', lastLoginAt: hoursAgo(Math.floor(Math.random() * 24)) },
      create: { id: u.id, name: u.name, email: u.email, role: u.role, organizationId: org.id, status: 'active', lastLoginAt: hoursAgo(Math.floor(Math.random() * 24)) },
    }))
  )
  await Promise.all(users.map(u => prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: u.id, organizationId: org.id } },
    update: { role: u.role },
    create: { userId: u.id, organizationId: org.id, role: u.role },
  })))

  // ── Providers ──────────────────────────────────────────────────────────────
  const providers = await Promise.all([
    prisma.provider.create({ data: { organizationId: org.id, userId: 'u_prov',  name: 'Dr. Emily Carter',  npi: 'SYN-1982746551', title: 'MD', signatureName: 'Emily Carter, MD' } }),
    prisma.provider.create({ data: { organizationId: org.id, userId: 'u_prov2', name: 'Dr. James Okafor', npi: 'SYN-1839472014', title: 'MD', signatureName: 'James Okafor, MD' } }),
    prisma.provider.create({ data: { organizationId: org.id, name: 'Dr. Sofia Marchetti', npi: 'SYN-1748392018', title: 'DO', signatureName: 'Sofia Marchetti, DO' } }),
    prisma.provider.create({ data: { organizationId: org.id, name: 'Dr. Rajesh Kumar',     npi: 'SYN-1657384902', title: 'MD', signatureName: 'Rajesh Kumar, MD' } }),
    prisma.provider.create({ data: { organizationId: org.id, name: 'Dr. Hannah Schmidt',  npi: 'SYN-1992038471', title: 'MD', signatureName: 'Hannah Schmidt, MD' } }),
  ])

  // ── Skills & Shifts ───────────────────────────────────────────────────────
  await Promise.all([
    prisma.userSkill.create({ data: { userId: 'u_ts1', specialtyId: specialties[0].id, proficiency: 'expert', certifications: 'CMT,AHDI' } }),
    prisma.userSkill.create({ data: { userId: 'u_ts2', specialtyId: specialties[1].id, proficiency: 'expert', certifications: 'CMT' } }),
    prisma.userSkill.create({ data: { userId: 'u_ed1', specialtyId: specialties[2].id, proficiency: 'expert', certifications: 'CMT,QA' } }),
    prisma.userSkill.create({ data: { userId: 'u_ed2', specialtyId: specialties[5].id, proficiency: 'expert', certifications: 'CMT' } }),
  ])
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  await Promise.all(users.filter(u => ['Transcriptionist','Medical Editor','QA Analyst'].includes(u.role))
    .flatMap(u => days.slice(0,5).map(d => prisma.shiftSchedule.create({ data: { userId: u.id, dayOfWeek: d, startTime: '08:00', endTime: '16:00', timezone: 'Asia/Kolkata' } }))))

  // ── Document Templates ───────────────────────────────────────────────────
  const tmplDefs = [
    { name: 'SOAP Note', type: 'SOAP Note', sections: ['Subjective','Objective','Assessment','Plan'] },
    { name: 'Consultation Note', type: 'Consultation Note', sections: ['Reason for Consult','History','Examination','Impression','Recommendation'] },
    { name: 'History & Physical', type: 'H&P', sections: ['Chief Complaint','HPI','Past History','Social History','ROS','Physical Exam','Assessment','Plan'] },
    { name: 'Operative Report', type: 'Operative Report', sections: ['Pre-op Diagnosis','Post-op Diagnosis','Procedure','Surgeon','Anesthesia','Findings','Closure'] },
    { name: 'Discharge Summary', type: 'Discharge Summary', sections: ['Admission Diagnoses','Discharge Diagnoses','Hospital Course','Discharge Medications','Follow-up'] },
    { name: 'Radiology Report', type: 'Radiology Report', sections: ['Exam','Indication','Comparison','Findings','Impression'] },
    { name: 'Procedure Note', type: 'Procedure Note', sections: ['Indication','Consent','Procedure','Complications','Estimated Blood Loss'] },
    { name: 'Follow-up Note', type: 'Follow-up Note', sections: ['Interval History','Examination','Assessment','Plan'] },
  ]
  const templates = await Promise.all(tmplDefs.map(t => prisma.documentTemplate.create({
    data: { organizationId: org.id, name: t.name, documentType: t.type, sectionsJson: JSON.stringify(t.sections), versionNumber: 1, status: 'active' }
  })))

  // ── Integration Connections ───────────────────────────────────────────────
  await Promise.all([
    prisma.integrationConnection.create({ data: { organizationId: org.id, type: 'epic', name: 'Epic Hyperspace', status: 'connected', lastSyncAt: hoursAgo(2) } }),
    prisma.integrationConnection.create({ data: { organizationId: org.id, type: 'cerner', name: 'Cerner Millennium', status: 'configured' } }),
    prisma.integrationConnection.create({ data: { organizationId: org.id, type: 'hl7_fhir', name: 'FHIR R4 Webhook', status: 'connected', lastSyncAt: hoursAgo(1) } }),
    prisma.integrationConnection.create({ data: { organizationId: org.id, type: 'sftp', name: 'Cardinal SFTP Drop', status: 'connected', lastSyncAt: hoursAgo(3) } }),
    prisma.integrationConnection.create({ data: { organizationId: org.id, type: 'rest_webhook', name: 'Ops Webhook (Slack)', status: 'connected' } }),
  ])

  // ── Delivery Destinations ────────────────────────────────────────────────
  await Promise.all([
    prisma.deliveryDestination.create({ data: { organizationId: org.id, name: 'Provider Portal', method: 'portal' } }),
    prisma.deliveryDestination.create({ data: { organizationId: org.id, name: 'EHR FHIR API', method: 'fhir', endpoint: 'https://ehr.cardinalhealth.demo/fhir/DocumentReference' } }),
    prisma.deliveryDestination.create({ data: { organizationId: org.id, name: 'HL7 Interface Engine', method: 'hl7' } }),
    prisma.deliveryDestination.create({ data: { organizationId: org.id, name: 'Records SFTP Archive', method: 'sftp', endpoint: 'sftp://archive.cardinalhealth.demo/reports/' } }),
  ])

  // ── Subscription & Usage ─────────────────────────────────────────────────
  const sub = await prisma.subscription.create({
    data: {
      organizationId: org.id,
      planTier: 'Professional',
      status: 'trialing',
      monthlyAudioMinutesLimit: 5000,
      seatsLimit: 50,
      storageLimitGb: 200,
      currentPeriodEnd: hoursAhead(14 * 24),
    }
  })
  await prisma.usageRecord.create({
    data: {
      organizationId: org.id,
      periodStart: daysAgo(28),
      periodEnd: now,
      audioMinutes: 3745.5,
      jobsProcessed: 824,
      aiMinutes: 3745.5,
      storageUsedGb: 47.3,
      costUsd: 412.86,
    }
  })

  // ── Transcription Jobs (matching FastAPI seeded JOB-2024-001..006 + more) ─
  const SAMPLE_TRANSCRIPT = `This is Dr. Emily Carter. I'm seeing the patient today for a cardiology follow-up. The patient is a 67-year-old male who presents with reduced exertional dyspnea over the past two weeks. Blood pressure today is 128 over 78, heart rate 72 and regular. Lungs are clear to auscultation bilaterally. No peripheral edema. ECG shows normal sinus rhythm with no acute ischemic changes. I will continue the current regimen of lisinopril 10 milligrams daily, metoprolol succinate 25 milligrams daily, and atorvastatin 40 milligrams at bedtime. We will recheck lipid panel in six weeks. The patient is to return to clinic in three months, sooner if symptoms recur.`
  const SAMPLE_STRUCTURED = JSON.stringify({
    documentType: 'SOAP Note',
    sections: [
      { title: 'Subjective', body: '67 y/o male presents for cardiology follow-up. Reports reduced exertional dyspnea over past 2 weeks.' },
      { title: 'Objective', body: 'BP 128/78, HR 72 regular. Lungs CTAB bilaterally. No peripheral edema. ECG: NSR, no acute ischemic changes.' },
      { title: 'Assessment', body: 'Stable CAD. Heart failure with preserved EF — improving functional class.' },
      { title: 'Plan', body: 'Continue lisinopril 10mg daily, metoprolol succinate 25mg daily, atorvastatin 40mg qhs. Recheck lipid panel in 6 weeks. Return in 3 months or sooner if symptoms recur.' },
    ],
    extracted_entities: { medications: ['Lisinopril 10mg','Metoprolol succinate 25mg','Atorvastatin 40mg'], diagnoses: ['Stable CAD','HFpEF'] },
    uncertain_markers: [],
  })
  const SAMPLE_QA_FINDINGS = JSON.stringify([
    { type: 'medication_conflict', severity: 'medium', detail: 'Lisinopril dose discrepancy (dictated 10mg vs prior record 20mg)', suggestion: 'Confirm with provider' },
    { type: 'laterality', severity: 'low', detail: 'Left/right ambiguity in knee exam', suggestion: 'Verify laterality' },
    { type: 'negation', severity: 'low', detail: '"no peripheral edema" confirmed; negation intact' },
  ])

  type JobDef = {
    num: string; status: string; priority: string; patient: string; enc: string;
    provIdx: number; facIdx: number; depIdx: number; specIdx: number; tmplIdx: number;
    durationSec: number; slaPct: number; slaRisk: string; assignedTo?: string; assignedRole?: string;
    audioName: string; transcript?: string; structured?: string; aiConf?: number; qualScore?: number; riskScore?: number; riskSeverity?: string;
    deliveryMethod?: string; clientInstr?: string; createdAgoH: number; slaDeadlineH: number;
  }
  const jobDefs: JobDef[] = [
    { num:'JOB-2024-001', status:'AI Draft Ready', priority:'Routine', patient:'SYN-884721', enc:'ENC-553210', provIdx:0, facIdx:0, depIdx:0, specIdx:0, tmplIdx:0, durationSec:273, slaPct:0.32, slaRisk:'on-track', audioName:'dictation_emily_carter_001.wav', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.92, qualScore:88, riskScore:0.22, riskSeverity:'medium', deliveryMethod:'fhir', clientInstr:'Use branded template, flag medication dose changes.', createdAgoH:6, slaDeadlineH:24 },
    { num:'JOB-2024-002', status:'Editing in progress', priority:'Urgent', patient:'SYN-884722', enc:'ENC-553211', provIdx:1, facIdx:1, depIdx:1, specIdx:1, tmplIdx:3, durationSec:412, slaPct:0.68, slaRisk:'at-risk', assignedTo:'u_ed1', assignedRole:'Medical Editor', audioName:'op_note_okafor_002.m4a', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.88, qualScore:84, riskScore:0.31, riskSeverity:'medium', clientInstr:'Verify laterality in operative field.', createdAgoH:18, slaDeadlineH:8 },
    { num:'JOB-2024-003', status:'Awaiting QA', priority:'Routine', patient:'SYN-884723', enc:'ENC-553212', provIdx:2, facIdx:0, depIdx:2, specIdx:2, tmplIdx:5, durationSec:187, slaPct:0.45, slaRisk:'on-track', assignedTo:'u_qa1', assignedRole:'QA Analyst', audioName:'radiology_marchetti_003.mp3', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.95, qualScore:91, riskScore:0.12, riskSeverity:'low', createdAgoH:10, slaDeadlineH:18 },
    { num:'JOB-2024-004', status:'Awaiting Provider Review', priority:'STAT', patient:'SYN-884724', enc:'ENC-553213', provIdx:3, facIdx:0, depIdx:3, specIdx:3, tmplIdx:0, durationSec:312, slaPct:0.88, slaRisk:'at-risk', audioName:'ed_note_kumar_004.wav', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.83, qualScore:79, riskScore:0.41, riskSeverity:'high', clientInstr:'STAT — discharge pending. Call on completion.', createdAgoH:3, slaDeadlineH:2 },
    { num:'JOB-2024-005', status:'Approved', priority:'Routine', patient:'SYN-884725', enc:'ENC-553214', provIdx:4, facIdx:0, depIdx:4, specIdx:4, tmplIdx:7, durationSec:248, slaPct:0.62, slaRisk:'on-track', audioName:'followup_schmidt_005.wav', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.93, qualScore:94, riskScore:0.08, riskSeverity:'low', createdAgoH:30, slaDeadlineH:6 },
    { num:'JOB-2024-006', status:'Delivered', priority:'Routine', patient:'SYN-884726', enc:'ENC-553215', provIdx:0, facIdx:0, depIdx:0, specIdx:0, tmplIdx:0, durationSec:195, slaPct:1.0, slaRisk:'on-track', audioName:'soap_carter_006.wav', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.94, qualScore:96, riskScore:0.05, riskSeverity:'informational', deliveryMethod:'fhir', createdAgoH:48, slaDeadlineH:-6 },
    { num:'JOB-2024-007', status:'Awaiting Transcriptionist', priority:'Urgent', patient:'SYN-884727', enc:'ENC-553216', provIdx:1, facIdx:1, depIdx:1, specIdx:1, tmplIdx:3, durationSec:358, slaPct:0.21, slaRisk:'on-track', assignedTo:'u_ts1', assignedRole:'Transcriptionist', audioName:'op_note_okafor_007.m4a', createdAgoH:4, slaDeadlineH:14 },
    { num:'JOB-2024-008', status:'AI Transcription in progress', priority:'Routine', patient:'SYN-884728', enc:'ENC-553217', provIdx:2, facIdx:0, depIdx:2, specIdx:2, tmplIdx:5, durationSec:223, slaPct:0.15, slaRisk:'on-track', audioName:'radiology_marchetti_008.mp3', createdAgoH:1, slaDeadlineH:20 },
    { num:'JOB-2024-009', status:'Submitted', priority:'STAT', patient:'SYN-884729', enc:'ENC-553218', provIdx:3, facIdx:0, depIdx:3, specIdx:3, tmplIdx:0, durationSec:165, slaPct:0.05, slaRisk:'on-track', audioName:'ed_note_kumar_009.wav', clientInstr:'Trauma activation — expedite.', createdAgoH:0.4, slaDeadlineH:4 },
    { num:'JOB-2024-010', status:'Intake validation', priority:'Routine', patient:'SYN-884730', enc:'ENC-553219', provIdx:4, facIdx:2, depIdx:5, specIdx:5, tmplIdx:3, durationSec:278, slaPct:0.02, slaRisk:'on-track', audioName:'op_note_schmidt_010.wav', createdAgoH:0.1, slaDeadlineH:24 },
    { num:'JOB-2024-011', status:'Clarification requested', priority:'Urgent', patient:'SYN-884731', enc:'ENC-553220', provIdx:0, facIdx:0, depIdx:0, specIdx:0, tmplIdx:0, durationSec:289, slaPct:0.55, slaRisk:'at-risk', audioName:'soap_carter_011.wav', transcript:SAMPLE_TRANSCRIPT, aiConf:0.71, qualScore:74, riskScore:0.48, riskSeverity:'high', createdAgoH:22, slaDeadlineH:10 },
    { num:'JOB-2024-012', status:'QA failed / rework', priority:'Urgent', patient:'SYN-884732', enc:'ENC-553221', provIdx:1, facIdx:1, depIdx:1, specIdx:1, tmplIdx:3, durationSec:367, slaPct:0.78, slaRisk:'at-risk', assignedTo:'u_ed2', assignedRole:'Medical Editor', audioName:'op_note_okafor_012.m4a', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.79, qualScore:68, riskScore:0.55, riskSeverity:'high', createdAgoH:26, slaDeadlineH:4 },
    { num:'JOB-2024-013', status:'Draft', priority:'Routine', patient:'SYN-884733', enc:'ENC-553222', provIdx:2, facIdx:0, depIdx:2, specIdx:2, tmplIdx:5, durationSec:142, slaPct:0.0, slaRisk:'on-track', audioName:'radiology_marchetti_013.mp3', createdAgoH:0.05, slaDeadlineH:24 },
    { num:'JOB-2024-014', status:'Escalated', priority:'STAT', patient:'SYN-884734', enc:'ENC-553223', provIdx:3, facIdx:0, depIdx:3, specIdx:3, tmplIdx:0, durationSec:198, slaPct:0.95, slaRisk:'breach', audioName:'ed_note_kumar_014.wav', transcript:SAMPLE_TRANSCRIPT, aiConf:0.81, qualScore:76, riskScore:0.52, riskSeverity:'high', clientInstr:'Escalated to ops manager — SLA breach imminent.', createdAgoH:5, slaDeadlineH:-1 },
    { num:'JOB-2024-015', status:'Delivered', priority:'Routine', patient:'SYN-884735', enc:'ENC-553224', provIdx:4, facIdx:2, depIdx:5, specIdx:5, tmplIdx:3, durationSec:264, slaPct:1.0, slaRisk:'on-track', audioName:'op_note_schmidt_015.wav', transcript:SAMPLE_TRANSCRIPT, structured:SAMPLE_STRUCTURED, aiConf:0.96, qualScore:97, riskScore:0.04, riskSeverity:'informational', deliveryMethod:'hl7', createdAgoH:72, slaDeadlineH:-24 },
  ]

  for (const j of jobDefs) {
    const job = await prisma.transcriptionJob.create({
      data: {
        jobNumber: j.num,
        organizationId: org.id,
        status: j.status,
        priority: j.priority,
        patientRef: j.patient,
        encounterRef: j.enc,
        providerId: providers[j.provIdx].id,
        facilityId: facilities[j.facIdx].id,
        departmentId: departments[j.depIdx].id,
        specialtyId: specialties[j.specIdx].id,
        templateId: templates[j.tmplIdx].id,
        documentType: templates[j.tmplIdx].documentType,
        audioFileName: j.audioName,
        audioDurationSec: j.durationSec,
        audioSizeBytes: j.durationSec * 16000,
        slaDeadline: hoursAhead(j.slaDeadlineH),
        slaPercent: j.slaPct,
        slaRiskLabel: j.slaRisk,
        deliveryDest: j.deliveryMethod,
        clientInstructions: j.clientInstr,
        transcriptText: j.transcript,
        structuredDocJson: j.structured,
        aiConfidence: j.aiConf,
        qualityScore: j.qualScore,
        riskScore: j.riskScore,
        riskSeverity: j.riskSeverity,
        assignedToId: j.assignedTo,
        createdAt: hoursAgo(j.createdAgoH),
      }
    })

    // Job events (timeline)
    const events = [
      { event: 'status_changed', from: null, to: 'Draft', detail: 'Job created', ago: j.createdAgoH + 0.05 },
    ]
    if (['Submitted','Intake validation','Awaiting Transcriptionist','AI Transcription in progress','AI Draft Ready','Editing in progress','Awaiting QA','QA failed / rework','Clarification requested','Awaiting Provider Review','Approved','Delivered','Escalated'].includes(j.status)) {
      events.push({ event: 'status_changed', from: 'Draft', to: 'Submitted', detail: 'Provider submitted dictation', ago: j.createdAgoH - 0.1 })
    }
    if (['Intake validation','Awaiting Transcriptionist','AI Transcription in progress','AI Draft Ready','Editing in progress','Awaiting QA','QA failed / rework','Clarification requested','Awaiting Provider Review','Approved','Delivered','Escalated'].includes(j.status)) {
      events.push({ event: 'intake_validated', from: 'Submitted', to: 'Intake validation', detail: 'Intake Validation Agent: checksum verified, malware clean', ago: j.createdAgoH - 0.2 })
    }
    if (['AI Transcription in progress','AI Draft Ready','Editing in progress','Awaiting QA','QA failed / rework','Clarification requested','Awaiting Provider Review','Approved','Delivered','Escalated'].includes(j.status)) {
      events.push({ event: 'transcribed', from: 'Awaiting Transcriptionist', to: 'AI Transcription in progress', detail: 'Transcription Agent: whisper-large-v3, confidence ' + (j.aiConf ?? 0.9).toFixed(2), ago: j.createdAgoH - 0.5 })
    }
    if (['AI Draft Ready','Editing in progress','Awaiting QA','QA failed / rework','Clarification requested','Awaiting Provider Review','Approved','Delivered','Escalated'].includes(j.status)) {
      events.push({ event: 'structured', from: 'AI Transcription in progress', to: 'AI Draft Ready', detail: 'Structuring Agent: mapped to ' + templates[j.tmplIdx].documentType, ago: j.createdAgoH - 0.6 })
    }
    if (j.assignedTo) {
      events.push({ event: 'assigned', from: 'AI Draft Ready', to: j.status, detail: `Work Allocation Agent → ${j.assignedRole}`, ago: j.createdAgoH - 0.7 })
    }
    if (['Awaiting QA','QA failed / rework','Awaiting Provider Review','Approved','Delivered'].includes(j.status)) {
      events.push({ event: 'qa_reviewed', from: 'Editing in progress', to: 'Awaiting QA', detail: `QA: score ${j.qualScore}/100, risk ${j.riskSeverity}`, ago: j.createdAgoH - 1.5 })
    }
    if (['Approved','Delivered'].includes(j.status)) {
      events.push({ event: 'approved', from: 'Awaiting Provider Review', to: 'Approved', detail: 'Provider electronic signature captured', ago: j.createdAgoH - 2 })
    }
    if (j.status === 'Delivered') {
      events.push({ event: 'delivered', from: 'Approved', to: 'Delivered', detail: `Delivery Agent: ${j.deliveryMethod ?? 'portal'}, 200 OK, 412ms`, ago: j.createdAgoH - 2.2 })
    }
    if (j.status === 'Escalated') {
      events.push({ event: 'escalated', from: 'Awaiting Provider Review', to: 'Escalated', detail: 'SLA breach — escalated to Operations Manager', ago: 0.5 })
    }
    if (j.status === 'Clarification requested') {
      events.push({ event: 'clarification', from: 'AI Draft Ready', to: 'Clarification requested', detail: 'Inaudible audio at 02:14 — query to provider', ago: 0.8 })
    }

    for (const e of events.reverse()) {
      await prisma.jobEvent.create({ data: {
        jobId: job.id,
        event: e.event,
        fromStatus: e.from,
        toStatus: e.to,
        actorName: e.event.includes('assigned') ? 'Work Allocation Agent' :
                   e.event.includes('transcribed') ? 'Transcription Agent' :
                   e.event.includes('structured') ? 'Structuring Agent' :
                   e.event.includes('intake') ? 'Intake Validation Agent' :
                   e.event.includes('qa') ? `${users.find(u=>u.id===j.assignedTo)?.name ?? 'QA Analyst'}` :
                   e.event.includes('approved') ? providers[j.provIdx].name :
                   e.event.includes('delivered') ? 'Delivery Agent' :
                   e.event.includes('escalated') ? 'SLA Monitoring Agent' :
                   e.event.includes('clarification') ? 'Onsite Coordinator' :
                   users.find(u => u.id === 'u_prov')!.name,
        detail: e.detail,
        createdAt: hoursAgo(e.ago),
      }})
    }

    // Assignment record
    if (j.assignedTo) {
      await prisma.assignment.create({ data: {
        jobId: job.id,
        userId: j.assignedTo,
        role: j.assignedRole ?? 'Transcriptionist',
        status: j.status === 'QA failed / rework' ? 'reassigned' : 'assigned',
        assignedReason: 'Specialty match, shift active, workload 4/10, QA score 94',
        createdAt: hoursAgo(j.createdAgoH - 0.7),
      }})
    }

    // Quality review (for jobs that have reached QA)
    if (['Awaiting QA','QA failed / rework','Awaiting Provider Review','Approved','Delivered','Escalated','Clarification requested'].includes(j.status)) {
      await prisma.qualityReview.create({ data: {
        jobId: job.id,
        reviewerId: j.status === 'QA failed / rework' ? 'u_qa2' : 'u_qa1',
        qualityScore: j.qualScore ?? 85,
        riskScore: j.riskScore ?? 0.2,
        riskSeverity: j.riskSeverity ?? 'medium',
        recommendedAction: j.status === 'QA failed / rework' ? 'route_to_rework' : (j.riskSeverity === 'high' ? 'route_to_qa' : 'send_to_provider_review'),
        findingsJson: SAMPLE_QA_FINDINGS,
        createdAt: hoursAgo(j.createdAgoH - 1.5),
      }})
    }

    // Clarification for the clarification job
    if (j.status === 'Clarification requested') {
      const cr = await prisma.clarificationRequest.create({ data: {
        jobId: job.id,
        creatorId: 'u_ed1',
        requestType: 'inaudible_audio',
        severity: 'medium',
        question: 'Audio segment 02:14–02:22 is inaudible due to background noise. Please confirm if the dictated medication is "Lisinopril 10mg" or "Lisinopril 20mg". SLA timer paused pending response.',
        status: 'open',
        slaPausedAt: hoursAgo(0.8),
      }})
      await prisma.clarificationMessage.create({ data: { clarificationId: cr.id, authorId: 'u_ed1', body: 'Flagging for provider review — dose ambiguity may affect QA findings.', isInternal: true, createdAt: hoursAgo(0.7) } })
    }

    // Delivery attempt for delivered jobs
    if (j.status === 'Delivered') {
      const dest = await prisma.deliveryDestination.findFirst({ where: { organizationId: org.id, method: j.deliveryMethod ?? 'portal' } })
      await prisma.deliveryAttempt.create({ data: {
        jobId: job.id,
        destinationId: dest?.id,
        method: j.deliveryMethod ?? 'portal',
        status: 'delivered',
        responseCode: 200,
        latencyMs: 412,
        retryCount: 0,
        createdAt: hoursAgo(j.createdAgoH - 2.2),
      }})
    }
  }
  console.log('  ✓ 15 transcription jobs across all workflow states')

  // ── Notifications ────────────────────────────────────────────────────────
  const notifs = [
    { userId: 'u_ts1', type: 'new_assignment', title: 'New assignment: JOB-2024-007', body: 'Operative Report — Dr. Okafor. SLA 14h remaining.' },
    { userId: 'u_qa1', type: 'new_assignment', title: 'QA review ready: JOB-2024-003', body: 'Radiology Report — Dr. Marchetti. Risk: low.' },
    { userId: 'u_ops', type: 'sla_risk', title: 'SLA risk: JOB-2024-014', body: 'STAT job at 95% SLA — imminent breach.' },
    { userId: 'u_ops', type: 'escalation', title: 'Escalation: JOB-2024-014', body: 'Escalated to Operations Manager.' },
    { userId: 'u_ed1', type: 'qa_failure', title: 'QA failed: JOB-2024-012', body: 'Rework required. Risk: high.' },
    { userId: 'u_prov', type: 'clarification_request', title: 'Clarification needed: JOB-2024-011', body: 'Dose ambiguity — confirm Lisinopril 10mg or 20mg.' },
    { userId: 'u_prov', type: 'provider_approval_required', title: 'Approval required: JOB-2024-004', body: 'STAT — discharge pending.' },
    { userId: 'u_admin', type: 'security_event', title: 'Security alert: bulk download', body: '42 document downloads in 10 minutes by user u_ts2.' },
    { userId: 'u_bill', type: 'subscription_issue', title: 'Trial ending in 14 days', body: 'Professional plan — 5,000 audio minutes/mo.' },
    { userId: 'u_dlvm', type: 'delivery_failure', title: 'Delivery retry: JOB-2024-006', body: 'FHIR endpoint timeout — retry #1 succeeded.' },
  ]
  for (const n of notifs) {
    await prisma.notification.create({ data: { organizationId: org.id, userId: n.userId, type: n.type, title: n.title, body: n.body, readAt: Math.random() > 0.6 ? hoursAgo(1) : null, createdAt: hoursAgo(Math.random()*12) } })
  }
  console.log('  ✓ 10 notifications')

  // ── Audit Events ──────────────────────────────────────────────────────────
  const auditActors = await Promise.all(users.slice(0, 8).map(u => prisma.auditActor.create({ data: { name: u.name, email: u.email, role: u.role } })))
  const auditEvents = [
    { actorId: auditActors[0].id, action: 'login', resourceType: 'session', severity: 'info', ip: '10.0.0.14', ago: 0.2, detail: 'MFA verified' },
    { actorId: auditActors[1].id, action: 'permission_change', resourceType: 'user', resourceId: 'u_ts3', severity: 'warning', ip: '10.0.0.22', ago: 2, detail: 'Role Transcriptionist → Medical Editor' },
    { actorId: auditActors[4].id, action: 'file_download', resourceType: 'document', resourceId: 'JOB-2024-006', severity: 'info', ip: '10.0.0.31', ago: 4, detail: 'Downloaded PDF — final transcript' },
    { actorId: auditActors[6].id, action: 'file_access', resourceType: 'document', resourceId: 'JOB-2024-001', severity: 'info', ip: '10.0.0.41', ago: 0.5, detail: 'Viewed in editor workspace' },
    { actorId: auditActors[7].id, action: 'failed_login', resourceType: 'session', severity: 'warning', ip: '10.0.0.99', ago: 8, detail: '3 consecutive failures — account not locked' },
    { actorId: auditActors[0].id, action: 'ai_call', resourceType: 'job', resourceId: 'JOB-2024-008', severity: 'info', ip: '10.0.0.14', ago: 0.8, detail: 'Transcription Agent: whisper-large-v3, cost $0.0011' },
    { actorId: auditActors[4].id, action: 'signature', resourceType: 'document', resourceId: 'JOB-2024-005', severity: 'critical', ip: '10.0.0.31', ago: 30, detail: 'Provider electronic signature' },
    { actorId: auditActors[0].id, action: 'delivery', resourceType: 'document', resourceId: 'JOB-2024-006', severity: 'info', ip: '10.0.0.14', ago: 48, detail: 'FHIR delivery 200 OK — 412ms' },
    { actorId: auditActors[3].id, action: 'support_access', resourceType: 'session', severity: 'warning', ip: '10.0.0.55', ago: 12, detail: 'Support access granted — expires in 4h' },
    { actorId: auditActors[6].id, action: 'export', resourceType: 'report', resourceId: 'report_quality_weekly', severity: 'info', ip: '10.0.0.41', ago: 24, detail: 'CSV export — 1,284 rows' },
  ]
  for (const e of auditEvents) {
    await prisma.auditEvent.create({ data: { organizationId: org.id, actorId: e.actorId, action: e.action, resourceType: e.resourceType, resourceId: e.resourceId, severity: e.severity, metadataJson: JSON.stringify({ detail: e.detail }), ip: e.ip, userAgent: 'MedFlow-Web/1.0', createdAt: hoursAgo(e.ago) } })
  }
  console.log('  ✓ 10 audit events')

  // ── Security Alerts ───────────────────────────────────────────────────────
  const secAlerts = [
    { type: 'bulk_download', severity: 'medium', userId: 'u_ts2', detail: '42 document downloads in 10 min', status: 'open', ago: 0.4 },
    { type: 'failed_login_burst', severity: 'medium', userId: 'u_qa2', detail: '5 failed logins in 60s from 10.0.0.99', status: 'acknowledged', ago: 8 },
    { type: 'support_access_expired', severity: 'low', userId: 'u_aud', detail: 'Support access for tenant expired and was auto-revoked', status: 'resolved', ago: 36 },
  ]
  for (const s of secAlerts) {
    await prisma.securityAlert.create({ data: { organizationId: org.id, type: s.type, severity: s.severity, userId: s.userId, detail: s.detail, status: s.status, createdAt: hoursAgo(s.ago) } })
  }
  console.log('  ✓ 3 security alerts')

  console.log('🎉 Seed complete. Demo tenant:', org.slug)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
