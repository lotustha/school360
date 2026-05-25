import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/material_controller.dart';
import 'package:intl/intl.dart';

class MaterialView extends StatelessWidget {
  final MaterialController controller = Get.put(MaterialController());

  MaterialView({super.key});

  IconData _iconForFileType(String? url) {
    if (url == null) return Icons.insert_drive_file_outlined;
    final lower = url.toLowerCase();
    if (lower.endsWith('.pdf')) return Icons.picture_as_pdf;
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return Icons.description;
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return Icons.slideshow;
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return Icons.table_chart;
    if (lower.endsWith('.jpg') || lower.endsWith('.png') || lower.endsWith('.jpeg')) return Icons.image_outlined;
    return Icons.insert_drive_file_outlined;
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
        title: const Text('Study Materials'),
        centerTitle: false,
        actions: [
          Obx(() {
            if (controller.materials.isEmpty) return const SizedBox.shrink();
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
                    '${controller.materials.length} files',
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
        if (controller.isLoading.value && controller.materials.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (controller.materials.isEmpty) {
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
                    Icons.folder_open_outlined,
                    size: 48,
                    color: colorScheme.outlineVariant,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No study materials',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Upload materials for your students.',
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
              itemCount: controller.materials.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final m = controller.materials[index];
                DateTime date;
                try {
                  date = DateTime.parse(m['createdAt']);
                } catch (_) {
                  date = DateTime.now();
                }

                final subjectName = m['subject']?['name']?.toString() ?? '';
                final className = m['class']?['name']?.toString() ?? '';
                final fileUrl = m['fileUrl']?.toString();

                return Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFc0c8cd)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        // File type icon
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: colorScheme.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Icon(
                            _iconForFileType(fileUrl),
                            size: 22,
                            color: colorScheme.primary,
                          ),
                        ),
                        const SizedBox(width: 16),

                        // Content
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                m['title']?.toString() ?? 'Untitled',
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: colorScheme.onSurface,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
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
                              const SizedBox(height: 2),
                              Text(
                                'Added ${DateFormat('MMM d, yyyy').format(date)}',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: colorScheme.outline,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Download button
                        SizedBox(
                          width: 40,
                          height: 40,
                          child: IconButton(
                            icon: const Icon(Icons.download_rounded, size: 20),
                            color: colorScheme.primary,
                            tooltip: 'Download',
                            style: IconButton.styleFrom(
                              backgroundColor:
                                  colorScheme.primary.withOpacity(0.08),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            onPressed: () => controller.downloadFile(m['fileUrl']),
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
      floatingActionButton: FloatingActionButton.extended(
        heroTag: null,
        onPressed: () => _showUploadSheet(context),
        icon: const Icon(Icons.upload_file),
        label: const Text('Upload'),
      ),
    );
  }

  void _showUploadSheet(BuildContext context) {
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
                  'Upload Material',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Share study materials with your students.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: controller.titleController,
                  decoration: InputDecoration(
                    labelText: 'Material Title',
                    hintText: 'e.g. Chapter 5 Notes',
                    filled: true,
                    fillColor: Colors.white,
                    prefixIcon: const Icon(Icons.title),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: BorderSide(color: colorScheme.outlineVariant),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: BorderSide(color: colorScheme.outlineVariant),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Obx(() => DropdownButtonFormField<String>(
                      decoration: InputDecoration(
                        labelText: 'Select Subject',
                        filled: true,
                        fillColor: Colors.white,
                        prefixIcon: const Icon(Icons.book_outlined),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(4),
                          borderSide:
                              BorderSide(color: colorScheme.outlineVariant),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(4),
                          borderSide:
                              BorderSide(color: colorScheme.outlineVariant),
                        ),
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
                          controller.selectedClassId.value =
                              subject['classId'];
                        }
                      },
                    )),
                const SizedBox(height: 16),
                Obx(() => OutlinedButton.icon(
                      onPressed: controller.pickFile,
                      icon: const Icon(Icons.attach_file, size: 18),
                      label: Text(
                        controller.selectedFile.value != null
                            ? controller.selectedFile.value!.name
                            : 'Choose File (PDF/Doc/Img)',
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    )),
                const SizedBox(height: 24),
                Obx(() => ElevatedButton.icon(
                      onPressed: controller.isSaving.value
                          ? null
                          : controller.uploadMaterial,
                      icon: controller.isSaving.value
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.cloud_upload),
                      label: Text(
                        controller.isSaving.value
                            ? 'Uploading...'
                            : 'Upload Material',
                      ),
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
