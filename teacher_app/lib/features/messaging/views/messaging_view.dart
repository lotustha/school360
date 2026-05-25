import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/messaging_controller.dart';

class MessagingView extends StatelessWidget {
  final MessagingController controller = Get.put(MessagingController());

  MessagingView({super.key});

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
        title: const Text('Messages'),
        centerTitle: false,
        actions: [
          Obx(() {
            final unreadCount = controller.conversations
                .where((c) => (c['unread'] as int? ?? 0) > 0)
                .length;
            if (unreadCount == 0) return const SizedBox.shrink();
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
                    '$unreadCount unread',
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
        if (controller.conversations.isEmpty) {
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
                    Icons.forum_outlined,
                    size: 48,
                    color: colorScheme.outlineVariant,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No conversations yet',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Start a new message to begin.',
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
              itemCount: controller.conversations.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final chat = controller.conversations[index];
                final unread = chat['unread'] as int? ?? 0;
                final name = chat['name']?.toString() ?? 'Unknown';

                return Container(
                  decoration: BoxDecoration(
                    color: unread > 0
                        ? colorScheme.primary.withOpacity(0.03)
                        : Colors.white,
                    border: Border.all(
                      color: unread > 0
                          ? colorScheme.primary.withOpacity(0.2)
                          : const Color(0xFFc0c8cd),
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        // Avatar
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundColor:
                                  colorScheme.primary.withOpacity(0.08),
                              child: Text(
                                _getInitials(name),
                                style: theme.textTheme.labelLarge?.copyWith(
                                  color: colorScheme.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            if (unread > 0)
                              Positioned(
                                top: -2,
                                right: -2,
                                child: Container(
                                  width: 12,
                                  height: 12,
                                  decoration: BoxDecoration(
                                    color: colorScheme.primary,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: Colors.white,
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 16),

                        // Message content
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      name,
                                      style:
                                          theme.textTheme.titleSmall?.copyWith(
                                        fontWeight: unread > 0
                                            ? FontWeight.w700
                                            : FontWeight.w600,
                                        color: colorScheme.onSurface,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    chat['time']?.toString() ?? '',
                                    style:
                                        theme.textTheme.labelSmall?.copyWith(
                                      color: unread > 0
                                          ? colorScheme.primary
                                          : colorScheme.onSurfaceVariant,
                                      fontWeight: unread > 0
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      chat['lastMessage']?.toString() ?? '',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style:
                                          theme.textTheme.bodySmall?.copyWith(
                                        color: unread > 0
                                            ? colorScheme.onSurface
                                            : colorScheme.onSurfaceVariant,
                                        fontWeight: unread > 0
                                            ? FontWeight.w600
                                            : FontWeight.w400,
                                      ),
                                    ),
                                  ),
                                  if (unread > 0) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: colorScheme.primary,
                                        borderRadius:
                                            BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        '$unread',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
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
        );
      }),
      floatingActionButton: FloatingActionButton(
        heroTag: null,
        onPressed: () {},
        child: const Icon(Icons.edit_square),
      ),
    );
  }
}
