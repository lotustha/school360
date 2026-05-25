import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/attendance_controller.dart';

class AttendanceView extends StatelessWidget {
  final AttendanceController controller = Get.put(AttendanceController());

  AttendanceView({super.key});

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
        title: const Text('Attendance'),
        actions: [
          Obx(() {
            if (controller.students.isEmpty) return const SizedBox.shrink();
            return TextButton.icon(
              onPressed: controller.markAllPresent,
              icon: Icon(Icons.done_all, size: 18, color: colorScheme.primary),
              label: Text(
                'All Present',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            );
          }),
          const SizedBox(width: 8),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            children: [
              // ── Filters Section ──
              _buildFiltersSection(context),

              // ── Content Area ──
              Expanded(
                child: Obx(() {
                  // Loading state
                  if (controller.isLoading.value) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  // Error state
                  if (controller.hasError.value.isNotEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(48),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.error_outline,
                                size: 48, color: colorScheme.error),
                            const SizedBox(height: 16),
                            Text(
                              controller.hasError.value,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            OutlinedButton.icon(
                              onPressed: () => controller.fetchStudents(),
                              icon: const Icon(Icons.refresh, size: 18),
                              label: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  // No classes
                  if (controller.classes.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(48),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: colorScheme.primary.withOpacity(0.06),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.class_outlined,
                                  size: 48, color: colorScheme.outlineVariant),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'No classes assigned',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: colorScheme.onSurface,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'You need routine entries to mark attendance.',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  // No students
                  if (controller.students.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(48),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: colorScheme.primary.withOpacity(0.06),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.people_outline,
                                  size: 48, color: colorScheme.outlineVariant),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'No students found',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: colorScheme.onSurface,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'This class has no active students.',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  // ── Students Loaded ──
                  return Column(
                    children: [
                      // Summary Stats
                      _buildSummaryStats(context),

                      // Student List
                      Expanded(child: _buildStudentList(context)),
                    ],
                  );
                }),
              ),
            ],
          ),
        ),
      ),
      // ── Bottom Save Bar ──
      bottomNavigationBar: Obx(() {
        if (controller.students.isEmpty) return const SizedBox.shrink();
        return _buildBottomBar(context);
      }),
    );
  }

  // ─────────────────────────────────────────────
  // Filters: Class Dropdown + Date
  // ─────────────────────────────────────────────
  Widget _buildFiltersSection(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Obx(() => Container(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              bottom: BorderSide(
                  color: colorScheme.outlineVariant.withOpacity(0.5)),
            ),
          ),
          child: Row(
            children: [
              // Class Dropdown
              Expanded(
                flex: 3,
                child: controller.classes.isEmpty
                    ? InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'CLASS',
                          prefixIcon: Icon(Icons.class_outlined, size: 20),
                        ),
                        child: Text(
                          'No classes',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      )
                    : DropdownButtonFormField<String>(
                        value: controller.selectedClassId.value.isEmpty
                            ? null
                            : controller.selectedClassId.value,
                        decoration: InputDecoration(
                          labelText: 'CLASS',
                          prefixIcon: Icon(Icons.class_outlined,
                              size: 20, color: colorScheme.onSurfaceVariant),
                          filled: true,
                          fillColor: colorScheme.surface,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 12),
                        ),
                        isExpanded: true,
                        items: controller.classes.map((c) {
                          return DropdownMenuItem<String>(
                            value: c['id'],
                            child: Text(
                              c['name'] ?? '',
                              style: theme.textTheme.bodyMedium,
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            controller.selectedClassId.value = val;
                            controller.fetchStudents();
                          }
                        },
                      ),
              ),
              const SizedBox(width: 16),
              // Date Display
              Expanded(
                flex: 2,
                child: InputDecorator(
                  decoration: InputDecoration(
                    labelText: 'DATE (BS)',
                    prefixIcon: Icon(Icons.calendar_today_outlined,
                        size: 18, color: colorScheme.onSurfaceVariant),
                    filled: true,
                    fillColor: colorScheme.surface,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                  ),
                  child: Text(
                    controller.selectedDateBS.value,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w500),
                  ),
                ),
              ),
            ],
          ),
        ));
  }

  // ─────────────────────────────────────────────
  // Summary Stats Bar
  // ─────────────────────────────────────────────
  Widget _buildSummaryStats(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Obx(() {
      final total = controller.students.length;
      int presentCount = 0;
      int absentCount = 0;

      for (var s in controller.students) {
        final status = controller.attendanceRecords[s['id']] ?? 'PRESENT';
        if (status == 'PRESENT') {
          presentCount++;
        } else {
          absentCount++;
        }
      }

      return Container(
        margin: const EdgeInsets.fromLTRB(24, 16, 24, 0),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFc0c8cd)),
        ),
        child: Row(
          children: [
            _StatChip(
                icon: Icons.groups_outlined,
                label: 'Total',
                value: '$total',
                color: colorScheme.primary),
            const SizedBox(width: 24),
            _StatChip(
                icon: Icons.check_circle_outline,
                label: 'Present',
                value: '$presentCount',
                color: const Color(0xFF24695f)),
            const SizedBox(width: 24),
            _StatChip(
                icon: Icons.cancel_outlined,
                label: 'Absent',
                value: '$absentCount',
                color: const Color(0xFF834b00)),
            const Spacer(),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF24695f).withOpacity(0.08),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                total > 0
                    ? '${(presentCount / total * 100).toStringAsFixed(0)}%'
                    : '0%',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: const Color(0xFF24695f),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      );
    });
  }

  // ─────────────────────────────────────────────
  // Student List
  // ─────────────────────────────────────────────
  Widget _buildStudentList(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Obx(() => ListView.separated(
          padding: const EdgeInsets.all(24),
          itemCount: controller.students.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final student = controller.students[index];
            final user = student['user'] as Map<String, dynamic>? ?? {};
            final studentId = student['id']?.toString() ?? '';
            final fullName = user['fullName']?.toString() ?? 'Unknown';
            final avatarUrl = user['avatarUrl']?.toString();
            final rollNumber = student['rollNumber']?.toString() ?? 'N/A';
            final status =
                controller.attendanceRecords[studentId] ?? 'PRESENT';
            final isPresent = status == 'PRESENT';

            return Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: const Color(0xFFc0c8cd)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  // Avatar
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: colorScheme.primary.withOpacity(0.08),
                    backgroundImage:
                        avatarUrl != null ? NetworkImage(avatarUrl) : null,
                    child: avatarUrl == null
                        ? Text(
                            _getInitials(fullName),
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: colorScheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 16),

                  // Name + Roll
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Roll #$rollNumber',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Status Toggle
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _StatusButton(
                        label: 'Present',
                        icon: Icons.check,
                        isSelected: isPresent,
                        selectedColor: const Color(0xFF24695f),
                        onTap: () => controller.updateStatus(
                            studentId, 'PRESENT'),
                      ),
                      const SizedBox(width: 8),
                      _StatusButton(
                        label: 'Absent',
                        icon: Icons.close,
                        isSelected: !isPresent,
                        selectedColor: const Color(0xFF834b00),
                        onTap: () => controller.updateStatus(
                            studentId, 'ABSENT'),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ));
  }

  // ─────────────────────────────────────────────
  // Bottom Save Bar
  // ─────────────────────────────────────────────
  Widget _buildBottomBar(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: colorScheme.outlineVariant),
        ),
      ),
      child: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 800),
            child: Row(
              children: [
                Icon(Icons.info_outline,
                    size: 16, color: colorScheme.onSurfaceVariant),
                const SizedBox(width: 8),
                Obx(() => Text(
                      '${controller.students.length} students',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                    )),
                const Spacer(),
                SizedBox(
                  width: 200,
                  child: Obx(() => ElevatedButton.icon(
                        onPressed: controller.isSaving.value
                            ? null
                            : controller.saveAttendance,
                        icon: controller.isSaving.value
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.save_outlined, size: 18),
                        label: Text(controller.isSaving.value
                            ? 'Saving...'
                            : 'Save Attendance'),
                      )),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return parts.isNotEmpty && parts.first.isNotEmpty
        ? parts.first[0].toUpperCase()
        : '?';
  }
}

// ═══════════════════════════════════════════════
// Stat Chip Widget
// ═══════════════════════════════════════════════
class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatChip({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
            ),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 10,
                  ),
            ),
          ],
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════
// Status Button Widget (Present / Absent toggle)
// ═══════════════════════════════════════════════
class _StatusButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final Color selectedColor;
  final VoidCallback onTap;

  const _StatusButton({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.selectedColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? selectedColor : Colors.transparent,
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
              color: isSelected
                  ? selectedColor
                  : Theme.of(context).colorScheme.outlineVariant,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 14,
                color: isSelected
                    ? Colors.white
                    : Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: 4),
              Text(
                label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isSelected
                          ? Colors.white
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
