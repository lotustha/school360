import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/routine_controller.dart';

class RoutineView extends StatelessWidget {
  final RoutineController controller = Get.put(RoutineController());

  RoutineView({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Get.back(),
        ),
        title: const Text('Schedule'),
        centerTitle: false,
        actions: [
          Obx(() {
            final dayRoutine =
                controller.weeklyRoutine[controller.selectedDay.value] ?? [];
            final classCount =
                dayRoutine.where((e) => !(e['periodSlot']?['isBreak'] ?? false)).length;
            return Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF24695f).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '$classCount ${classCount == 1 ? 'class' : 'classes'}',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: const Color(0xFF24695f),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
      body: Column(
        children: [
          // ─── Day Selector Strip ───
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: colorScheme.outlineVariant),
              ),
            ),
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                itemCount: controller.dayNames.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  return Obx(() {
                    final isSelected =
                        controller.selectedDay.value == index;
                    final isToday =
                        (DateTime.now().weekday % 7) == index;

                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => controller.selectDay(index),
                        borderRadius: BorderRadius.circular(4),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeInOut,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 0),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? colorScheme.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(4),
                            border: isSelected
                                ? null
                                : Border.all(
                                    color: isToday
                                        ? colorScheme.primary
                                            .withOpacity(0.4)
                                        : colorScheme.outlineVariant,
                                  ),
                          ),
                          child: Center(
                            child: Text(
                              controller.dayNames[index],
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: isSelected
                                    ? Colors.white
                                    : isToday
                                        ? colorScheme.primary
                                        : colorScheme.onSurfaceVariant,
                                fontWeight: isSelected || isToday
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  });
                },
              ),
            ),
          ),

          // ─── Routine Content ───
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) {
                return const Center(child: CircularProgressIndicator());
              }

              final dayRoutine =
                  controller.weeklyRoutine[controller.selectedDay.value] ??
                      [];

              if (dayRoutine.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(48),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: colorScheme.outlineVariant
                                .withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.free_breakfast_outlined,
                            size: 48,
                            color: colorScheme.outlineVariant,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'No classes scheduled',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Enjoy your ${controller.dayNames[controller.selectedDay.value]}!',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: colorScheme.outline,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: controller.fetchRoutine,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 800),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Section header
                          Row(
                            children: [
                              Icon(Icons.schedule,
                                  size: 18,
                                  color: colorScheme.onSurfaceVariant),
                              const SizedBox(width: 8),
                              Text(
                                '${_fullDayName(controller.selectedDay.value)}\'s Schedule',
                                style:
                                    theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Timeline list
                          ListView.builder(
                            shrinkWrap: true,
                            physics:
                                const NeverScrollableScrollPhysics(),
                            itemCount: dayRoutine.length,
                            itemBuilder: (context, index) {
                              final entry = dayRoutine[index];
                              final isBreak =
                                  entry['periodSlot']?['isBreak'] ??
                                      false;
                              final isLast =
                                  index == dayRoutine.length - 1;

                              return _buildTimelineItem(
                                context,
                                entry: entry,
                                isBreak: isBreak,
                                isLast: isLast,
                                index: index,
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  /// Builds a single timeline row with a connector line on the left.
  Widget _buildTimelineItem(
    BuildContext context, {
    required Map<String, dynamic> entry,
    required bool isBreak,
    required bool isLast,
    required int index,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final startTime = entry['periodSlot']?['startTime'] ?? '';
    final endTime = entry['periodSlot']?['endTime'] ?? '';
    final subjectName =
        isBreak ? 'Break' : (entry['subject']?['name'] ?? 'Class');
    final className = entry['class']?['name'];
    final periodName = entry['periodSlot']?['name'];

    // Accent color per entry
    final accentColor =
        isBreak ? const Color(0xFF834b00) : const Color(0xFF24695f);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ─── Timeline gutter ───
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: isBreak
                        ? colorScheme.outlineVariant
                        : accentColor,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isBreak
                          ? colorScheme.outlineVariant
                          : accentColor.withOpacity(0.3),
                      width: 2,
                    ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: colorScheme.outlineVariant.withOpacity(0.5),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // ─── Content Card ───
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: isBreak
                  ? _buildBreakRow(context, startTime, endTime)
                  : _buildClassCard(
                      context,
                      startTime: startTime,
                      endTime: endTime,
                      subjectName: subjectName,
                      className: className,
                      periodName: periodName,
                      accentColor: accentColor,
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// A compact break indicator — no full card, just a subtle row.
  Widget _buildBreakRow(
      BuildContext context, String startTime, String endTime) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.35),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.5),
          style: BorderStyle.solid,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.free_breakfast_outlined,
              size: 16, color: colorScheme.outline),
          const SizedBox(width: 8),
          Text(
            'Break',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
              fontStyle: FontStyle.italic,
            ),
          ),
          const Spacer(),
          Text(
            '$startTime – $endTime',
            style: theme.textTheme.labelSmall?.copyWith(
              color: colorScheme.outline,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  /// A full class card with subject, class name, time, and period badge.
  Widget _buildClassCard(
    BuildContext context, {
    required String startTime,
    required String endTime,
    required String subjectName,
    required String? className,
    required String? periodName,
    required Color accentColor,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top accent bar
          Container(
            height: 3,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(7)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Subject & period badge row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Subject icon
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: accentColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Icon(Icons.menu_book_outlined,
                          size: 20, color: accentColor),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            subjectName,
                            style:
                                theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: colorScheme.onSurface,
                            ),
                          ),
                          if (className != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              className,
                              style: theme.textTheme.bodySmall
                                  ?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (periodName != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHighest
                              .withOpacity(0.5),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          periodName,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                // Divider
                Divider(
                    height: 1,
                    color:
                        colorScheme.outlineVariant.withOpacity(0.5)),
                const SizedBox(height: 12),
                // Time row
                Row(
                  children: [
                    Icon(Icons.access_time,
                        size: 15, color: colorScheme.outline),
                    const SizedBox(width: 6),
                    Text(
                      '$startTime – $endTime',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _fullDayName(int dayIndex) {
    const names = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ];
    return names[dayIndex];
  }
}
