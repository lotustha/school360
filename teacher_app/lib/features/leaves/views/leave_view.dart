import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/leave_controller.dart';
import 'package:intl/intl.dart';

class LeaveView extends StatelessWidget {
  final LeaveController controller = Get.put(LeaveController());

  LeaveView({super.key});

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
        title: const Text('Leave Management'),
        centerTitle: false,
        actions: [
          Obx(() {
            if (controller.leaves.isEmpty) return const SizedBox.shrink();
            final pendingCount = controller.leaves
                .where((l) => l['status'] == 'PENDING')
                .length;
            if (pendingCount == 0) return const SizedBox.shrink();
            return Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF834b00).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '$pendingCount pending',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: const Color(0xFF834b00),
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

        if (controller.leaves.isEmpty) {
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
                    Icons.event_busy_outlined,
                    size: 48,
                    color: colorScheme.outlineVariant,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No leave history',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Your leave requests will appear here.',
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
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                // Summary stats
                _buildSummaryRow(context),
                const SizedBox(height: 24),

                // Section header
                Row(
                  children: [
                    Text(
                      'Leave History',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                        letterSpacing: 0.1,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: colorScheme.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${controller.leaves.length}',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: colorScheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Leave cards
                ...List.generate(controller.leaves.length, (index) {
                  final leave = controller.leaves[index];
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom:
                          index < controller.leaves.length - 1 ? 12 : 0,
                    ),
                    child: _buildLeaveCard(context, leave),
                  );
                }),
              ],
            ),
          ),
        );
      }),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: null,
        onPressed: () => _showApplyLeaveBottomSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('Apply'),
      ),
    );
  }

  Widget _buildSummaryRow(BuildContext context) {
    final approved =
        controller.leaves.where((l) => l['status'] == 'APPROVED').length;
    final pending =
        controller.leaves.where((l) => l['status'] == 'PENDING').length;
    final rejected =
        controller.leaves.where((l) => l['status'] == 'REJECTED').length;

    return Row(
      children: [
        Expanded(
          child: _StatCard(
            icon: Icons.check_circle_outline,
            label: 'Approved',
            value: '$approved',
            iconColor: const Color(0xFF24695f),
            iconBg: const Color(0xFF24695f).withOpacity(0.1),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.hourglass_empty,
            label: 'Pending',
            value: '$pending',
            iconColor: const Color(0xFF834b00),
            iconBg: const Color(0xFF834b00).withOpacity(0.1),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.cancel_outlined,
            label: 'Rejected',
            value: '$rejected',
            iconColor: Theme.of(context).colorScheme.error,
            iconBg: Theme.of(context).colorScheme.errorContainer.withOpacity(0.4),
          ),
        ),
      ],
    );
  }

  Widget _buildLeaveCard(BuildContext context, dynamic leave) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final format = DateFormat('MMM d, yyyy');

    DateTime start, end;
    try {
      start = DateTime.parse(leave['startDate']);
      end = DateTime.parse(leave['endDate']);
    } catch (_) {
      start = DateTime.now();
      end = DateTime.now();
    }

    final days = end.difference(start).inDays + 1;
    final status = leave['status']?.toString() ?? 'PENDING';

    Color statusColor;
    Color statusBg;
    IconData statusIcon;

    if (status == 'APPROVED') {
      statusColor = const Color(0xFF24695f);
      statusBg = const Color(0xFF24695f).withOpacity(0.1);
      statusIcon = Icons.check_circle_outline;
    } else if (status == 'REJECTED') {
      statusColor = colorScheme.error;
      statusBg = colorScheme.errorContainer.withOpacity(0.4);
      statusIcon = Icons.cancel_outlined;
    } else {
      statusColor = const Color(0xFF834b00);
      statusBg = const Color(0xFF834b00).withOpacity(0.1);
      statusIcon = Icons.hourglass_empty;
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
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Icon(statusIcon, size: 20, color: statusColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${format.format(start)} – ${format.format(end)}',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$days ${days == 1 ? 'day' : 'days'}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    status,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: statusColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Reason
          if (leave['reason'] != null &&
              leave['reason'].toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                leave['reason'],
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface,
                  height: 1.5,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
    );
  }

  void _showApplyLeaveBottomSheet(BuildContext context) {
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
                  'Apply for Leave',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Select dates and provide a reason for your leave.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: Obx(() => OutlinedButton.icon(
                            icon: const Icon(Icons.date_range, size: 18),
                            label: Text(DateFormat('MMM d')
                                .format(controller.startDate.value)),
                            onPressed: () async {
                              final date = await showDatePicker(
                                context: context,
                                initialDate: controller.startDate.value,
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now()
                                    .add(const Duration(days: 365)),
                              );
                              if (date != null) {
                                controller.startDate.value = date;
                              }
                            },
                            style: OutlinedButton.styleFrom(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          )),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Icon(Icons.arrow_forward,
                          size: 18,
                          color: colorScheme.onSurfaceVariant),
                    ),
                    Expanded(
                      child: Obx(() => OutlinedButton.icon(
                            icon: const Icon(Icons.date_range, size: 18),
                            label: Text(DateFormat('MMM d')
                                .format(controller.endDate.value)),
                            onPressed: () async {
                              final date = await showDatePicker(
                                context: context,
                                initialDate: controller.endDate.value,
                                firstDate: controller.startDate.value,
                                lastDate: DateTime.now()
                                    .add(const Duration(days: 365)),
                              );
                              if (date != null) {
                                controller.endDate.value = date;
                              }
                            },
                            style: OutlinedButton.styleFrom(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          )),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: controller.reasonController,
                  decoration: InputDecoration(
                    labelText: 'Reason for leave',
                    hintText: 'Describe why you need time off...',
                    filled: true,
                    fillColor: Colors.white,
                    prefixIcon: const Icon(Icons.notes),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: BorderSide(color: colorScheme.outlineVariant),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: BorderSide(color: colorScheme.outlineVariant),
                    ),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 24),
                Obx(() => ElevatedButton.icon(
                      onPressed: controller.isSaving.value
                          ? null
                          : controller.applyLeave,
                      icon: controller.isSaving.value
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.send),
                      label: Text(controller.isSaving.value
                          ? 'Submitting...'
                          : 'Submit Application'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    )),
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
        color: Colors.white,
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
