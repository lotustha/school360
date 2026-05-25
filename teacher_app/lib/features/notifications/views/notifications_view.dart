import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/notifications_controller.dart';

class NotificationsView extends StatelessWidget {
  final NotificationsController controller = Get.put(NotificationsController());

  NotificationsView({super.key});

  IconData _iconForType(String? type) {
    switch (type) {
      case 'attendance':
        return Icons.check_circle_outline;
      case 'grade':
        return Icons.grading;
      case 'assignment':
        return Icons.assignment_outlined;
      case 'notice':
        return Icons.campaign_outlined;
      case 'message':
        return Icons.mail_outline;
      case 'leave':
        return Icons.calendar_month_outlined;
      default:
        return Icons.notifications_outlined;
    }
  }

  Color _colorForType(BuildContext context, String? type) {
    switch (type) {
      case 'attendance':
        return const Color(0xFF24695f);
      case 'grade':
        return const Color(0xFF834b00);
      case 'assignment':
        return const Color(0xFF834b00);
      case 'notice':
        return Theme.of(context).colorScheme.primary;
      case 'message':
        return Theme.of(context).colorScheme.primary;
      case 'leave':
        return const Color(0xFF24695f);
      default:
        return Theme.of(context).colorScheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Get.back(),
        ),
        title: const Text('Notifications'),
        actions: [
          Obx(() {
            final hasUnread = controller.notifications
                .any((n) => n['isRead'] == false);
            return TextButton.icon(
              onPressed: hasUnread ? controller.markAllAsRead : null,
              icon: Icon(
                Icons.done_all,
                size: 18,
                color: hasUnread
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant.withOpacity(0.4),
              ),
              label: Text(
                'Mark all read',
                style: textTheme.labelMedium?.copyWith(
                  color: hasUnread
                      ? colorScheme.primary
                      : colorScheme.onSurfaceVariant.withOpacity(0.4),
                  fontWeight: FontWeight.w600,
                ),
              ),
            );
          }),
        ],
      ),
      body: Obx(() {
        if (controller.isLoading.value) {
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: ListView.separated(
                padding: const EdgeInsets.all(24),
                itemCount: 5,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) => _buildSkeletonCard(context),
              ),
            ),
          );
        }

        if (controller.notifications.isEmpty) {
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
                    Icons.notifications_off_outlined,
                    size: 48,
                    color: colorScheme.outlineVariant,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No notifications yet',
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'You\'re all caught up!',
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          );
        }

        // Count unread
        final unreadCount = controller.notifications
            .where((n) => n['isRead'] == false)
            .length;

        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 800),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Unread count summary
                if (unreadCount > 0)
                  Padding(
                    padding:
                        const EdgeInsets.fromLTRB(24, 20, 24, 4),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: colorScheme.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '$unreadCount unread',
                            style: textTheme.labelMedium?.copyWith(
                              color: colorScheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                // Notification list
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: controller.fetchNotifications,
                    color: colorScheme.primary,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 16),
                      itemCount: controller.notifications.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final notif = controller.notifications[index];
                        final isRead = notif['isRead'] as bool? ?? false;
                        final type = notif['type'] as String?;
                        final iconColor = _colorForType(context, type);

                        return Container(
                          decoration: BoxDecoration(
                            color: isRead
                                ? colorScheme.surface
                                : colorScheme.primary.withOpacity(0.03),
                            border: Border.all(
                              color: isRead
                                  ? colorScheme.outlineVariant
                                  : colorScheme.primary.withOpacity(0.2),
                              width: 1,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                // Icon container with unread dot
                                Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: isRead
                                            ? colorScheme
                                                .surfaceContainerHighest
                                                .withOpacity(0.5)
                                            : iconColor.withOpacity(0.1),
                                        borderRadius:
                                            BorderRadius.circular(4),
                                      ),
                                      child: Icon(
                                        _iconForType(type),
                                        size: 22,
                                        color: isRead
                                            ? colorScheme
                                                .onSurfaceVariant
                                            : iconColor,
                                      ),
                                    ),
                                    if (!isRead)
                                      Positioned(
                                        top: -3,
                                        right: -3,
                                        child: Container(
                                          width: 10,
                                          height: 10,
                                          decoration: BoxDecoration(
                                            color: colorScheme.primary,
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: colorScheme.surface,
                                              width: 1.5,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(width: 16),
                                // Content
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: Text(
                                              notif['title'] ?? '',
                                              style: textTheme
                                                  .titleSmall
                                                  ?.copyWith(
                                                fontWeight: isRead
                                                    ? FontWeight.w500
                                                    : FontWeight.w700,
                                                color: isRead
                                                    ? colorScheme
                                                        .onSurfaceVariant
                                                    : colorScheme
                                                        .onSurface,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Container(
                                            padding:
                                                const EdgeInsets
                                                    .symmetric(
                                                    horizontal: 8,
                                                    vertical: 3),
                                            decoration: BoxDecoration(
                                              color: colorScheme
                                                  .surfaceContainerHighest,
                                              borderRadius:
                                                  BorderRadius
                                                      .circular(4),
                                            ),
                                            child: Text(
                                              notif['time'] ?? '',
                                              style: textTheme
                                                  .labelSmall
                                                  ?.copyWith(
                                                color: colorScheme
                                                    .onSurfaceVariant,
                                                fontWeight:
                                                    FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        notif['body'] ?? '',
                                        style: textTheme.bodySmall
                                            ?.copyWith(
                                          color: colorScheme
                                              .onSurfaceVariant,
                                          height: 1.4,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }

  Widget _buildSkeletonCard(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outlineVariant, width: 1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 14,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color:
                        colorScheme.surfaceContainerHighest.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  height: 12,
                  width: 200,
                  decoration: BoxDecoration(
                    color:
                        colorScheme.surfaceContainerHighest.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
