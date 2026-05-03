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

  // Nepali Subject with Internal/External marking
  const subject = await prisma.subject.create({
    data: {
      name: 'Nepali',
      code: '0002',
      classId: class11.id,
      schoolId: school.id,
      creditHours: 4.0,
      components: {
        create: [
          {
            type: 'INTERNAL',
            subCode: '0003',
            fullMarks: 25,
            passMarks: 10,
            breakdown: { participation: 3, project: 16, term1: 3, term2: 3 }
          },
          {
            type: 'EXTERNAL',
            fullMarks: 75,
            passMarks: 27,
          }
        ]
      }
    }
  })

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
