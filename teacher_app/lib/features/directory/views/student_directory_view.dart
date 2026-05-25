import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/directory_controller.dart';

class StudentDirectoryView extends StatelessWidget {
  final DirectoryController controller = Get.put(DirectoryController());

  StudentDirectoryView({super.key});

  String _getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return parts.first.isNotEmpty ? parts.first[0].toUpperCase() : '?';
  }

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
        title: const Text('Student Directory'),
        centerTitle: false,
        actions: [
          Obx(() => controller.isLoading.value
              ? const Padding(
                  padding: EdgeInsets.only(right: 16),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : IconButton(
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh',
                  onPressed: controller.fetchDirectory,
                )),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            children: [
              // Search bar section
              Container(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 12),
                child: TextField(
                  onChanged: controller.updateSearch,
                  style: theme.textTheme.bodyMedium,
                  decoration: InputDecoration(
                    hintText: 'Search by name...',
                    hintStyle: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant.withOpacity(0.6),
                    ),
                    prefixIcon: Icon(
                      Icons.search,
                      color: colorScheme.onSurfaceVariant,
                      size: 20,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: colorScheme.outlineVariant),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: colorScheme.outlineVariant),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: colorScheme.primary, width: 1.5),
                    ),
                  ),
                ),
              ),

              // Result count
              Obx(() {
                if (controller.isLoading.value) {
                  return const SizedBox.shrink();
                }
                final count = controller.filteredStudents.length;
                final total = controller.students.length;
                final isFiltered = controller.searchQuery.value.isNotEmpty;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    children: [
                      Icon(
                        Icons.people_outline,
                        size: 16,
                        color: colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isFiltered
                            ? '$count of $total students'
                            : '$total students',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                );
              }),

              const SizedBox(height: 8),

              // Student list
              Expanded(
                child: Obx(() {
                  if (controller.isLoading.value) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  final students = controller.filteredStudents;

                  if (controller.students.isEmpty) {
                    return _buildEmptyState(
                      context,
                      icon: Icons.people_outline,
                      title: 'No students yet',
                      subtitle: 'Student data will appear here once loaded.',
                    );
                  }

                  if (students.isEmpty) {
                    return _buildEmptyState(
                      context,
                      icon: Icons.search_off,
                      title: 'No results found',
                      subtitle:
                          'No students match "${controller.searchQuery.value}"',
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
                    itemCount: students.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final student = students[index];
                      return _buildStudentCard(context, student);
                    },
                  );
                }),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStudentCard(
      BuildContext context, Map<String, dynamic> student) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final name = student['name']?.toString() ?? 'Unknown';
    final className = student['class']?.toString() ?? '';
    final roll = student['roll']?.toString() ?? '';
    final avatarUrl = student['avatar']?.toString();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 22,
              backgroundColor: colorScheme.primary.withOpacity(0.08),
              backgroundImage:
                  avatarUrl != null && avatarUrl.isNotEmpty
                      ? NetworkImage(avatarUrl)
                      : null,
              child: avatarUrl == null || avatarUrl.isEmpty
                  ? Text(
                      _getInitials(name),
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 16),

            // Student info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (className.isNotEmpty) ...[
                        _buildMetaChip(
                          context,
                          icon: Icons.class_outlined,
                          label: className,
                        ),
                        const SizedBox(width: 12),
                      ],
                      if (roll.isNotEmpty)
                        _buildMetaChip(
                          context,
                          icon: Icons.tag,
                          label: 'Roll $roll',
                        ),
                    ],
                  ),
                ],
              ),
            ),

            // Action button
            SizedBox(
              width: 36,
              height: 36,
              child: IconButton(
                icon: const Icon(Icons.message_outlined, size: 18),
                color: colorScheme.primary,
                tooltip: 'Message',
                style: IconButton.styleFrom(
                  backgroundColor: colorScheme.primary.withOpacity(0.08),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: () {
                  // TODO: Navigate to messaging
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetaChip(
    BuildContext context, {
    required IconData icon,
    required String label,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: colorScheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: colorScheme.primary.withOpacity(0.06),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 40,
                color: colorScheme.onSurfaceVariant.withOpacity(0.5),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
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
}
