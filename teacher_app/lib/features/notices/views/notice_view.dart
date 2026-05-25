import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/notice_controller.dart';
import 'package:intl/intl.dart';

class NoticeView extends StatelessWidget {
  final NoticeController controller = Get.put(NoticeController());

  NoticeView({super.key});

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
        title: const Text('Notices'),
        centerTitle: false,
        actions: [
          Obx(() {
            if (controller.notices.isEmpty) return const SizedBox.shrink();
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
                    '${controller.notices.length} notices',
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

        if (controller.notices.isEmpty) {
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
                    Icons.campaign_outlined,
                    size: 48,
                    color: colorScheme.outlineVariant,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No notices yet',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Active notices will appear here.',
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
            child: RefreshIndicator(
              onRefresh: controller.fetchNotices,
              color: colorScheme.primary,
              child: ListView.separated(
                padding: const EdgeInsets.all(24),
                itemCount: controller.notices.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final notice = controller.notices[index];
                  DateTime date;
                  try {
                    date = DateTime.parse(notice['createdAt']);
                  } catch (_) {
                    date = DateTime.now();
                  }

                  final isRecent =
                      DateTime.now().difference(date).inDays <= 1;

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
                          padding:
                              const EdgeInsets.fromLTRB(16, 16, 16, 12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color:
                                      colorScheme.primary.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Icon(
                                  Icons.campaign,
                                  size: 20,
                                  color: colorScheme.primary,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      notice['title']?.toString() ?? '',
                                      style: theme.textTheme.titleSmall
                                          ?.copyWith(
                                        fontWeight: FontWeight.w700,
                                        color: colorScheme.onSurface,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      DateFormat('MMM d, yyyy').format(date),
                                      style: theme.textTheme.bodySmall
                                          ?.copyWith(
                                        color:
                                            colorScheme.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (isRecent)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF24695f)
                                        .withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    'New',
                                    style: theme.textTheme.labelSmall
                                        ?.copyWith(
                                      color: const Color(0xFF24695f),
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),

                        // Content
                        Padding(
                          padding:
                              const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          child: Text(
                            notice['content']?.toString() ?? '',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: colorScheme.onSurface,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        );
      }),
    );
  }
}
