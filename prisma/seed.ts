import { prisma } from '../src/lib/prisma'
import { SYSTEM_PERMISSIONS } from '../src/lib/permissions'
import * as bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding database...')

  // 1. Seed Permissions
  console.log('Seeding permissions...')
  for (const module of SYSTEM_PERMISSIONS) {
    for (const perm of module.permissions) {
      await prisma.permission.upsert({
        where: { code: perm.code },
        update: { description: perm.description },
        create: {
          code: perm.code,
          description: perm.description,
        },
      })
    }
  }

  // 2. Create Global Super Admin Role
  console.log('Seeding SUPER_ADMIN role...')
  const superAdminRole = await prisma.role.upsert({
    where: {
      name_schoolId: {
        name: 'SUPER_ADMIN',
        schoolId: '', // Wait, schoolId is optional, Prisma upsert with null is tricky. We'll do findFirst/create
      }
    },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'System-wide Super Administrator',
    }
  }).catch(async () => {
     let role = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN', schoolId: null } })
     if (!role) {
       role = await prisma.role.create({ data: { name: 'SUPER_ADMIN', description: 'System-wide Super Administrator' }})
     }
     return role
  })

  // Assign all permissions to SUPER_ADMIN
  const allPerms = await prisma.permission.findMany()
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: perm.id
        }
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: perm.id
      }
    })
  }

  // 3. Create a default School
  console.log('Seeding school...')
  const school = await prisma.school.upsert({
    where: { slug: 'padmodaya' },
    update: {},
    create: {
      name: 'Padmodaya Public School',
      slug: 'padmodaya',
      themeColor: '#10b981', // Mint Green
    },
  })

  // 4. Create an Admin User
  console.log('Seeding admin user...')
  const hashedPassword = await bcrypt.hash('password123', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@padmodaya.edu' },
    update: {},
    create: {
      fullName: 'System Admin',
      email: 'admin@padmodaya.edu',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      roleId: superAdminRole.id,
      schoolId: school.id,
    },
  })

  // 5. Create Academic Structure (Nepal NEB Example)
  console.log('Seeding academic structure...')
  const faculty = await prisma.faculty.create({
    data: {
      name: 'Science',
      schoolId: school.id,
    }
  })

  const class11 = await prisma.class.create({
    data: {
      name: 'Class 11',
      facultyId: faculty.id,
      schoolId: school.id,
    }
  })

  const sectionA = await prisma.section.create({
    data: {
      name: 'A',
      classId: class11.id,
      schoolId: school.id,
    }
  })

  // Nepali Subject (plain — components live on Evaluation, not on Subject)
  const subject = await prisma.subject.create({
    data: {
      name: 'Nepali',
      code: '0002',
      classId: class11.id,
      schoolId: school.id,
      creditHours: 4.0,
    }
  })

  // 6. Academic Year + Exam (so Marks workspace has something selectable)
  console.log('Seeding academic year + exam...')
  const academicYear = await prisma.academicYear.create({
    data: {
      name:        '2081-2082',
      startDateBS: '2081-04-01',
      endDateBS:   '2082-03-30',
      isCurrent:   true,
      schoolId:    school.id,
    },
  })

  // 6a. Three Terminal Exams (testing events; no dates, no weightage)
  const examTerm1 = await prisma.exam.create({
    data: { name: 'Term 1',     schoolId: school.id, academicYearId: academicYear.id },
  })
  const examTerm2 = await prisma.exam.create({
    data: { name: 'Term 2',     schoolId: school.id, academicYearId: academicYear.id },
  })
  await prisma.exam.create({
    data: { name: 'Final Term', schoolId: school.id, academicYearId: academicYear.id },
  })

  // 6b. Sample Evaluation: "First Internal Evaluation" for Class 11 (Math/Nepali)
  console.log('Seeding sample evaluation...')
  const evalFirstInternal = await prisma.evaluation.create({
    data: {
      schoolId:       school.id,
      classId:        class11.id,
      academicYearId: academicYear.id,
      name:           'First Internal Evaluation',
      sequenceNumber: 1,
      isFinal:        false,
    },
  })

  const subjectEval = await prisma.subjectEvaluation.create({
    data: {
      evaluationId: evalFirstInternal.id,
      subjectId:    subject.id,
      internalMax:  50,
      externalMax:  0,
    },
  })

  // Components: Attendance(4, ATTENDANCE) + Project(36, MANUAL) + Term 1(10, DERIVED, source=50)
  await prisma.evaluationComponent.createMany({
    data: [
      {
        subjectEvaluationId: subjectEval.id,
        part:                'INTERNAL',
        label:               'Attendance',
        maxMarks:            4,
        orderIndex:          0,
        source:              'ATTENDANCE',
      },
      {
        subjectEvaluationId: subjectEval.id,
        part:                'INTERNAL',
        label:               'Practical and Project Work',
        maxMarks:            36,
        orderIndex:          1,
        source:              'MANUAL',
      },
      {
        subjectEvaluationId: subjectEval.id,
        part:                'INTERNAL',
        label:               'Term 1 Exam',
        maxMarks:            10,
        orderIndex:          2,
        source:              'DERIVED_FROM_EXAM',
        sourceExamId:        examTerm1.id,
        sourceMaxMarks:      50,
      },
    ],
  })

  // 7. Sample students in Class 11 Section A
  console.log('Seeding sample students...')
  const sampleStudents = [
    { name: 'Aarav Sharma',    gender: 'MALE',   roll: '01' },
    { name: 'Anaya Pokhrel',   gender: 'FEMALE', roll: '02' },
    { name: 'Bishal Thapa',    gender: 'MALE',   roll: '03' },
    { name: 'Diya KC',         gender: 'FEMALE', roll: '04' },
    { name: 'Eshan Adhikari',  gender: 'MALE',   roll: '05' },
  ]
  for (let i = 0; i < sampleStudents.length; i++) {
    const s = sampleStudents[i]
    const studentUser = await prisma.user.create({
      data: {
        fullName: s.name,
        email:    `student${i + 1}@padmodaya.edu`,
        password: hashedPassword,
        role:     'STUDENT',
        schoolId: school.id,
      },
    })
    await prisma.student.create({
      data: {
        userId:         studentUser.id,
        schoolId:       school.id,
        admissionNo:    `2081-${String(i + 1).padStart(4, '0')}`,
        rollNumber:     s.roll,
        classId:        class11.id,
        sectionId:      sectionA.id,
        academicYearId: academicYear.id,
        dobBS:          '2065-03-15',
        gender:         s.gender,
        status:         'ACTIVE',
      },
    })
  }

  console.log('Seeding completed successfully! 🌱')
  console.log(`Test Login -> Email: admin@padmodaya.edu | Password: password123 | Tenant URL: http://padmodaya.localhost:3000`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
