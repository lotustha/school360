import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/assignment_controller.dart';
import 'package:intl/intl.dart';

class AssignmentView extends StatelessWidget {
  final AssignmentController controller = Get.put(AssignmentController());

  AssignmentView({super.key});

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
        title: const Text('Assignments'),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: controller.fetchAssignments,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Obx(() {
        if (controller.isLoading.value && controller.assignments.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (controller.assignments.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.assignment_outlined,
                    size: 48,
                    color: colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'No assignments yet',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Create your first assignment to get started.',
                  style: theme.textTheme.bodySmall?.copyWith(
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
            child: RefreshIndicator(
              onRefresh: controller.fetchAssignments,
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  // --- Summary Stats Row ---
                  _buildSummaryRow(context),
                  const SizedBox(height: 24),

                  // --- Section Header ---
                  Row(
                    children: [
                      Text(
                        'All Assignments',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: colorScheme.onSurface,
                          letterSpacing: 0.1,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${controller.assignments.length}',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: colorScheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // --- Assignment Cards ---
                  ...List.generate(controller.assignments.length, (index) {
                    final a = controller.assignments[index];
                    return Padding(
                      padding: EdgeInsets.only(
                        bottom:
                            index < controller.assignments.length - 1 ? 16 : 0,
                      ),
                      child: _buildAssignmentCard(context, a),
                    );
                  }),
                ],
              ),
            ),
          ),
        );
      }),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: null,
        onPressed: () => _showCreateSheet(context),
        icon: const Icon(Icons.add_task),
        label: const Text('Create'),
      ),
    );
  }

  // --- Summary Stats Row ---
  Widget _buildSummaryRow(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final now = DateTime.now();

    int totalSubmissions = 0;
    int overdueCount = 0;

    for (final a in controller.assignments) {
      try {
        totalSubmissions += (a['_count']?['submissions'] ?? 0) as int;
        final due = DateTime.parse(a['dueDate']);
        if (due.isBefore(now)) overdueCount++;
      } catch (_) {}
    }

    return Row(
      children: [
        Expanded(
          child: _StatCard(
            icon: Icons.assignment_outlined,
            label: 'Total',
            value: '${controller.assignments.length}',
            iconColor: colorScheme.primary,
            iconBg: colorScheme.primary.withOpacity(0.1),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.people_alt_outlined,
            label: 'Submissions',
            value: '$totalSubmissions',
            iconColor: const Color(0xFF24695f),
            iconBg: const Color(0xFF24695f).withOpacity(0.1),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.warning_amber_rounded,
            label: 'Overdue',
            value: '$overdueCount',
            iconColor: const Color(0xFF834b00),
            iconBg: const Color(0xFF834b00).withOpacity(0.1),
          ),
        ),
      ],
    );
  }

  // --- Assignment Card ---
  Widget _buildAssignmentCard(BuildContext context, dynamic a) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final now = DateTime.now();

    DateTime due;
    try {
      due = DateTime.parse(a['dueDate']);
    } catch (_) {
      due = now;
    }

    final daysUntilDue = due.difference(now).inDays;
    final isOverdue = due.isBefore(now);
    final isDueSoon = !isOverdue && daysUntilDue <= 3;

    // Status colors
    Color dueBadgeColor;
    Color dueBadgeBg;
    String dueLabel;

    if (isOverdue) {
      dueBadgeColor = colorScheme.error;
      dueBadgeBg = colorScheme.errorContainer.withOpacity(0.4);
      dueLabel = 'Overdue';
    } else if (isDueSoon) {
      dueBadgeColor = const Color(0xFF834b00);
      dueBadgeBg = const Color(0xFF834b00).withOpacity(0.1);
      dueLabel = 'Due Soon';
    } else {
      dueBadgeColor = const Color(0xFF24695f);
      dueBadgeBg = const Color(0xFF24695f).withOpacity(0.1);
      dueLabel = 'Upcoming';
    }

    final submissions = a['_count']?['submissions'] ?? 0;
    final subjectName = a['subject']?['name'] ?? '';
    final className = a['class']?['name'] ?? '';

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border.all(color: const Color(0xFFc0c8cd)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // --- Card Header ---
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon accent
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Icon(
                    Icons.assignment,
                    size: 20,
                    color: colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                // Title + Subject
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        a['title'] ?? '',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [subjectName, className]
                            .where((s) => s.isNotEmpty)
                            .join(' • '),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Due badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: dueBadgeBg,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    dueLabel,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: dueBadgeColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // --- Description (if present) ---
          if (a['description'] != null &&
              a['description'].toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                a['description'],
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface,
                  height: 1.5,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),

          // --- Footer ---
          Container(
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: const Color(0xFFc0c8cd).withOpacity(0.6)),
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                // Due date
                Icon(
                  Icons.calendar_today_outlined,
                  size: 14,
                  color: colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 6),
                Text(
                  DateFormat('MMM d, yyyy').format(due),
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 20),
                // Submissions
                Icon(
                  Icons.people_alt_outlined,
                  size: 14,
                  color: colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 6),
                Text(
                  '$submissions Submission${submissions == 1 ? '' : 's'}',
                  style: theme.textTheme.labelMedium?.copyWith(
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
  }

  // --- Create Assignment Bottom Sheet ---
  void _showCreateSheet(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    Get.bottomSheet(
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
        ),
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colorScheme.onSurfaceVariant.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Create Assignment',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Fill in the details to create a new assignment.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: controller.titleController,
                  decoration: const InputDecoration(
                    labelText: 'Title',
                    hintText: 'e.g. Chapter 5 Worksheet',
                    filled: true,
                    prefixIcon: Icon(Icons.title),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: controller.descController,
                  decoration: const InputDecoration(
                    labelText: 'Description / Instructions',
                    hintText: 'Provide details about the assignment...',
                    filled: true,
                    prefixIcon: Icon(Icons.description_outlined),
                    alignLabelWithHint: true,
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 16),
                Obx(
                  () => DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Select Subject',
                      filled: true,
                      prefixIcon: Icon(Icons.book_outlined),
                    ),
                    items: controller.subjects.map((s) {
                      return DropdownMenuItem<String>(
                        value: s['id'],
                        child: Text(s['name']),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        controller.selectedSubjectId.value = val;
                        final subject = controller.subjects
                            .firstWhere((s) => s['id'] == val);
                        controller.selectedClassId.value = subject['classId'];
                      }
                    },
                  ),
                ),
                const SizedBox(height: 16),
                Obx(
                  () => OutlinedButton.icon(
                    onPressed: () async {
                      final date = await showDatePicker(
                        context: context,
                        initialDate: controller.dueDate.value,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (date != null) controller.dueDate.value = date;
                    },
                    icon: const Icon(Icons.calendar_month),
                    label: Text(
                      'Due Date: ${DateFormat('MMM d, yyyy').format(controller.dueDate.value)}',
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Obx(
                  () => ElevatedButton.icon(
                    onPressed:
                        controller.isSaving.value
                            ? null
                            : controller.createAssignment,
                    icon: controller.isSaving.value
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.check),
                    label: Text(
                      controller.isSaving.value
                          ? 'Creating...'
                          : 'Create Assignment',
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
      isScrollControlled: true,
    );
  }
}

// --- Stat Card Widget ---
class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color iconColor;
  final Color iconBg;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.iconColor,
    required this.iconBg,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border.all(color: const Color(0xFFc0c8cd)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
