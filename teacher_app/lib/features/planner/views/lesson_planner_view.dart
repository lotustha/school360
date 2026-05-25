import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/lesson_planner_controller.dart';
import 'package:intl/intl.dart';

class LessonPlannerView extends StatelessWidget {
  final LessonPlannerController controller = Get.put(LessonPlannerController());

  LessonPlannerView({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: const Text('Lesson Planner'),
        centerTitle: false,
        actions: [
          Obx(() {
            if (controller.lessons.isEmpty) return const SizedBox.shrink();
            return Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${controller.lessons.length} plans',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
      body: Obx(() {
        if (controller.isLoading.value) {
          return const Center(child: CircularProgressIndicator());
        }

        if (controller.lessons.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withOpacity(0.06),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.auto_stories_outlined,
                    size: 48,
                    color: colorScheme.outlineVariant,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No lesson plans yet',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Tap + to create your first lesson plan.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          );
        }

        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 800),
            child: ListView.separated(
              padding: const EdgeInsets.all(24),
              itemCount: controller.lessons.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final lesson = controller.lessons[index];
                DateTime date;
                try {
                  date = DateTime.parse(lesson['date']);
                } catch (_) {
                  date = DateTime.now();
                }

                final status = lesson['status']?.toString() ?? 'Planned';
                final isCompleted =
                    status.toLowerCase() == 'completed' || status.toLowerCase() == 'taught';

                Color statusColor;
                Color statusBg;
                if (isCompleted) {
                  statusColor = const Color(0xFF24695f);
                  statusBg = const Color(0xFF24695f).withOpacity(0.1);
                } else if (status.toLowerCase() == 'draft') {
                  statusColor = colorScheme.onSurfaceVariant;
                  statusBg =
                      colorScheme.surfaceContainerHighest.withOpacity(0.5);
                } else {
                  statusColor = colorScheme.primary;
                  statusBg = colorScheme.primary.withOpacity(0.1);
                }

                return Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFc0c8cd)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Icon
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: colorScheme.primary.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Icon(
                                Icons.auto_stories,
                                size: 20,
                                color: colorScheme.primary,
                              ),
                            ),
                            const SizedBox(width: 12),
                            // Content
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lesson['topic']?.toString() ?? 'Untitled',
                                    style:
                                        theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: colorScheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    [
                                      lesson['subject']?.toString(),
                                      lesson['class']?.toString()
                                    ]
                                        .where((s) =>
                                            s != null && s.isNotEmpty)
                                        .join(' • '),
                                    style:
                                        theme.textTheme.bodySmall?.copyWith(
                                      color: colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Status badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusBg,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                status,
                                style:
                                    theme.textTheme.labelSmall?.copyWith(
                                  color: statusColor,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Footer
                      Container(
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color:
                                  const Color(0xFFc0c8cd).withOpacity(0.6),
                            ),
                          ),
                        ),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            Icon(
                              Icons.calendar_today_outlined,
                              size: 14,
                              color: colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              DateFormat('MMM d, yyyy').format(date),
                              style:
                                  theme.textTheme.labelMedium?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      }),
      floatingActionButton: FloatingActionButton(
        heroTag: null,
        onPressed: () {},
        child: const Icon(Icons.add),
      ),
    );
  }
}
