import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/auth_controller.dart';

class SchoolSelectionView extends StatelessWidget {
  final List<dynamic> schools;
  final AuthController controller = Get.find<AuthController>();

  SchoolSelectionView({super.key, required this.schools});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 40),

                  // Header section
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colorScheme.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.school_outlined,
                      size: 28,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Select Your School',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You have access to multiple schools. Choose which one you\'d like to continue with.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // School count badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: colorScheme.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${schools.length} ${schools.length == 1 ? 'school' : 'schools'} available',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // School list
                  Expanded(
                    child: ListView.separated(
                      itemCount: schools.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final school = schools[index];
                        return _buildSchoolCard(context, school);
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSchoolCard(BuildContext context, dynamic school) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => controller.loginWithSchool(school['id']),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFc0c8cd)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              // School logo/avatar
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: colorScheme.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                  image: school['logoUrl'] != null
                      ? DecorationImage(
                          image: NetworkImage(school['logoUrl']),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: school['logoUrl'] == null
                    ? Icon(
                        Icons.apartment,
                        size: 28,
                        color: colorScheme.primary,
                      )
                    : null,
              ),
              const SizedBox(width: 16),

              // School info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      school['name'] ?? 'Unknown School',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.link,
                          size: 14,
                          color: colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '@${school['slug']}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Arrow
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colorScheme.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Icon(
                  Icons.arrow_forward,
                  size: 18,
                  color: colorScheme.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
