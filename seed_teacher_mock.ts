import { PrismaClient } from './generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding teacher mock data...');

  // Get admin user
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@padmodaya.edu' } });
  if (!adminUser) throw new Error("Admin not found");

  const school = await prisma.school.findFirst({ where: { slug: 'padmodaya' } });
  if (!school) throw new Error("School not found");

  const class11 = await prisma.class.findFirst({ where: { name: 'Class 11' } });
  if (!class11) throw new Error("Class not found");

  const subject = await prisma.subject.findFirst({ where: { name: 'Nepali' } });
  if (!subject) throw new Error("Subject not found");

  // 1. Assign Admin as Class Teacher
  await prisma.class.update({
    where: { id: class11.id },
    data: { classTeacherId: adminUser.id }
  });

  // 2. Seed Lesson Plans
  await prisma.lessonPlan.createMany({
    data: [
      {
        date: new Date(),
        topic: 'Introduction to Nepali Literature',
        status: 'Planned',
        schoolId: school.id,
        classId: class11.id,
        subjectId: subject.id,
        teacherId: adminUser.id,
      },
      {
        date: new Date(Date.now() + 86400000), // Tomorrow
        topic: 'Grammar Basics',
        status: 'Draft',
        schoolId: school.id,
        classId: class11.id,
        subjectId: subject.id,
        teacherId: adminUser.id,
      }
    ]
  });

  // 3. Seed App Notifications
  await prisma.appNotification.createMany({
    data: [
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'New Assignment Submission',
        body: 'Aarav Sharma submitted Math Homework.',
        isRead: false,
        type: 'ASSIGNMENT',
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Staff Meeting',
        body: 'Reminder: Monthly staff meeting at 3 PM today.',
        isRead: true,
        type: 'MEETING',
      }
    ]
  });

  // 4. Seed Conversation
  const conversation = await prisma.conversation.create({
    data: {
      schoolId: school.id,
      title: 'Staff Room Group',
      isGroup: true,
    }
  });

  await prisma.conversationParticipant.create({
    data: {
      conversationId: conversation.id,
      userId: adminUser.id,
      unreadCount: 2,
    }
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderId: adminUser.id,
        content: 'Don\'t forget to submit your grades by Friday.',
      }
    ]
  });

  console.log('Successfully seeded teacher mock data!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
