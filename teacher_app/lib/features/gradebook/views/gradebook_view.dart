import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/gradebook_controller.dart';

class GradebookView extends StatelessWidget {
  final GradebookController controller = Get.put(GradebookController());

  GradebookView({super.key});

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
        title: const Text('Gradebook'),
        centerTitle: false,
      ),
      body: Obx(() {
        if (controller.exams.isEmpty && controller.isLoading.value) {
          return const Center(child: CircularProgressIndicator());
        }

        return Column(
          children: [
            // Filter row
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 800),
                  child: Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: controller.selectedExamId.value.isEmpty
                              ? null
                              : controller.selectedExamId.value,
                          decoration: InputDecoration(
                            labelText: 'EXAM',
                            filled: true,
                            fillColor: colorScheme.surface,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(4),
                              borderSide: BorderSide(
                                  color: colorScheme.outlineVariant),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(4),
                              borderSide: BorderSide(
                                  color: colorScheme.outlineVariant),
                            ),
                          ),
                          items: controller.exams.map((e) {
                            return DropdownMenuItem<String>(
                              value: e['id'],
                              child: Text(
                                '${e['name']} (${e['academicYear']['name']})',
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              controller.selectedExamId.value = val;
                              controller.fetchStudentsAndScores();
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: controller.selectedSubjectId.value.isEmpty
                              ? null
                              : controller.selectedSubjectId.value,
                          decoration: InputDecoration(
                            labelText: 'SUBJECT & CLASS',
                            filled: true,
                            fillColor: colorScheme.surface,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(4),
                              borderSide: BorderSide(
                                  color: colorScheme.outlineVariant),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(4),
                              borderSide: BorderSide(
                                  color: colorScheme.outlineVariant),
                            ),
                          ),
                          items: controller.subjects.map((s) {
                            return DropdownMenuItem<String>(
                              value: s['id'],
                              child: Text(
                                s['name'],
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              controller.selectedSubjectId.value = val;
                              controller.fetchStudentsAndScores();
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Divider
            Divider(height: 1, color: colorScheme.outlineVariant),

            // Student list
            Expanded(
              child: controller.isLoading.value
                  ? const Center(child: CircularProgressIndicator())
                  : controller.students.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(24),
                                decoration: BoxDecoration(
                                  color:
                                      colorScheme.primary.withOpacity(0.06),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.grading,
                                  size: 48,
                                  color: colorScheme.outlineVariant,
                                ),
                              ),
                              const SizedBox(height: 20),
                              Text(
                                'No students found',
                                style:
                                    theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Select an exam and subject to view students.',
                                style:
                                    theme.textTheme.bodyMedium?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        )
                      : SingleChildScrollView(
                          padding: const EdgeInsets.all(24),
                          child: Center(
                            child: ConstrainedBox(
                              constraints:
                                  const BoxConstraints(maxWidth: 800),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  border: Border.all(
                                      color: const Color(0xFFc0c8cd)),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Column(
                                  children: [
                                    // Table header
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 24, vertical: 12),
                                      decoration: BoxDecoration(
                                        color: colorScheme
                                            .surfaceContainerHighest
                                            .withOpacity(0.5),
                                        borderRadius:
                                            const BorderRadius.vertical(
                                                top: Radius.circular(7)),
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              'STUDENT',
                                              style: theme
                                                  .textTheme.labelMedium
                                                  ?.copyWith(
                                                color: colorScheme
                                                    .onSurfaceVariant,
                                                fontWeight: FontWeight.w700,
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 16),
                                          SizedBox(
                                            width: 80,
                                            child: Text(
                                              'ABSENT',
                                              style: theme
                                                  .textTheme.labelMedium
                                                  ?.copyWith(
                                                color: colorScheme
                                                    .onSurfaceVariant,
                                                fontWeight: FontWeight.w700,
                                                letterSpacing: 0.5,
                                              ),
                                              textAlign: TextAlign.center,
                                            ),
                                          ),
                                          const SizedBox(width: 16),
                                          SizedBox(
                                            width: 80,
                                            child: Text(
                                              'SCORE',
                                              style: theme
                                                  .textTheme.labelMedium
                                                  ?.copyWith(
                                                color: colorScheme
                                                    .onSurfaceVariant,
                                                fontWeight: FontWeight.w700,
                                                letterSpacing: 0.5,
                                              ),
                                              textAlign: TextAlign.center,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const Divider(height: 1),

                                    // Student rows
                                    ListView.separated(
                                      shrinkWrap: true,
                                      physics:
                                          const NeverScrollableScrollPhysics(),
                                      itemCount:
                                          controller.students.length,
                                      separatorBuilder: (_, __) =>
                                          Divider(
                                        height: 1,
                                        color: colorScheme.outlineVariant
                                            .withOpacity(0.5),
                                      ),
                                      itemBuilder: (context, index) {
                                        final student =
                                            controller.students[index];
                                        final initialScore = controller
                                                .scores[student['id']]
                                                ?.toString() ??
                                            '';
                                        final isAbsent = controller
                                                .absentees[student['id']] ??
                                            false;

                                        return Padding(
                                          padding:
                                              const EdgeInsets.symmetric(
                                                  horizontal: 16,
                                                  vertical: 12),
                                          child: Row(
                                            children: [
                                              CircleAvatar(
                                                radius: 20,
                                                backgroundColor: colorScheme
                                                    .primary
                                                    .withOpacity(0.08),
                                                backgroundImage: student[
                                                                    'user']
                                                                [
                                                                'avatarUrl'] !=
                                                            null
                                                    ? NetworkImage(
                                                        student['user']
                                                            ['avatarUrl'])
                                                    : null,
                                                child: student['user']
                                                            [
                                                            'avatarUrl'] ==
                                                        null
                                                    ? Icon(Icons.person,
                                                        size: 20,
                                                        color: colorScheme
                                                            .primary)
                                                    : null,
                                              ),
                                              const SizedBox(width: 16),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment
                                                          .start,
                                                  children: [
                                                    Text(
                                                      student['user']
                                                          ['fullName'],
                                                      style: theme
                                                          .textTheme
                                                          .titleSmall
                                                          ?.copyWith(
                                                        fontWeight:
                                                            FontWeight.w600,
                                                      ),
                                                    ),
                                                    Text(
                                                      'Roll: ${student['rollNumber'] ?? 'N/A'}',
                                                      style: theme
                                                          .textTheme
                                                          .bodySmall
                                                          ?.copyWith(
                                                        color: colorScheme
                                                            .onSurfaceVariant,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              SizedBox(
                                                width: 80,
                                                child: Center(
                                                  child: Switch(
                                                    value: isAbsent,
                                                    onChanged: (val) =>
                                                        controller
                                                            .toggleAbsent(
                                                                student[
                                                                    'id'],
                                                                val),
                                                    activeColor:
                                                        colorScheme.error,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 16),
                                              SizedBox(
                                                width: 80,
                                                child: TextFormField(
                                                  initialValue:
                                                      initialScore,
                                                  enabled: !isAbsent,
                                                  keyboardType:
                                                      TextInputType.number,
                                                  textAlign:
                                                      TextAlign.center,
                                                  decoration:
                                                      InputDecoration(
                                                    contentPadding:
                                                        const EdgeInsets
                                                            .symmetric(
                                                            horizontal: 8,
                                                            vertical: 8),
                                                    hintText: isAbsent
                                                        ? 'N/A'
                                                        : 'Score',
                                                    hintStyle: theme
                                                        .textTheme
                                                        .bodySmall
                                                        ?.copyWith(
                                                      color: colorScheme
                                                          .outline,
                                                    ),
                                                    border:
                                                        OutlineInputBorder(
                                                      borderRadius:
                                                          BorderRadius
                                                              .circular(4),
                                                      borderSide: BorderSide(
                                                          color: colorScheme
                                                              .outlineVariant),
                                                    ),
                                                    enabledBorder:
                                                        OutlineInputBorder(
                                                      borderRadius:
                                                          BorderRadius
                                                              .circular(4),
                                                      borderSide: BorderSide(
                                                          color: colorScheme
                                                              .outlineVariant),
                                                    ),
                                                    filled: true,
                                                    fillColor: isAbsent
                                                        ? colorScheme
                                                            .surfaceContainerHighest
                                                            .withOpacity(
                                                                0.3)
                                                        : Colors.white,
                                                  ),
                                                  onChanged: (val) =>
                                                      controller
                                                          .updateScore(
                                                              student[
                                                                  'id'],
                                                              val),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
            ),
          ],
        );
      }),
      bottomNavigationBar: Obx(() => Container(
            padding: const EdgeInsets.all(24),
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
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed:
                          controller.isSaving.value || controller.students.isEmpty
                              ? null
                              : controller.saveScores,
                      icon: controller.isSaving.value
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.save),
                      label: Text(
                        controller.isSaving.value
                            ? 'Saving...'
                            : 'Save Scores',
                      ),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          )),
    );
  }
}
