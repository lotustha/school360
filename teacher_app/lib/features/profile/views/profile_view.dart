import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import '../controllers/profile_controller.dart';
import '../../auth/views/login_view.dart';

class ProfileView extends StatelessWidget {
  final ProfileController controller = Get.put(ProfileController());

  ProfileView({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        centerTitle: false,
      ),
      body: Obx(() {
        if (controller.isLoading.value) {
          return const Center(child: CircularProgressIndicator());
        }

        final p = controller.profile;
        if (p.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 48, color: colorScheme.outlineVariant),
                const SizedBox(height: 16),
                Text(
                  'Failed to load profile',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: controller.fetchProfile,
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        final fullName = p['fullName'] ?? 'Unknown';
        final initials = fullName.isNotEmpty ? fullName[0].toUpperCase() : 'T';
        final schoolName = p['school']?['name'] ?? '';
        final email = p['email'] ?? 'N/A';
        final phone = p['phone'] ?? 'N/A';
        final classCount = p['_count']?['classesTaught']?.toString() ?? '0';
        final subjectCount = p['_count']?['subjectAssignments']?.toString() ?? '0';
        final leaveCount = p['_count']?['leaveRequests']?.toString() ?? '0';

        return RefreshIndicator(
          onRefresh: controller.fetchProfile,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // ── Profile Header Card ──
                      Container(
                        decoration: BoxDecoration(
                          color: colorScheme.primaryContainer,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            children: [
                              CircleAvatar(
                                radius: 44,
                                backgroundColor: colorScheme.primary,
                                backgroundImage: p['avatarUrl'] != null
                                    ? NetworkImage(p['avatarUrl'])
                                    : null,
                                child: p['avatarUrl'] == null
                                    ? Text(
                                        initials,
                                        style: theme.textTheme.headlineMedium?.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      )
                                    : null,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                fullName,
                                style: theme.textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              if (schoolName.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  schoolName,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // ── Stats Card ──
                      Container(
                        decoration: BoxDecoration(
                          color: colorScheme.surface,
                          border: Border.all(color: colorScheme.outlineVariant),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 20),
                        child: IntrinsicHeight(
                          child: Row(
                            children: [
                              Expanded(child: _buildStat(context, classCount, 'Classes')),
                              VerticalDivider(
                                width: 1,
                                thickness: 1,
                                color: colorScheme.outlineVariant,
                              ),
                              Expanded(child: _buildStat(context, subjectCount, 'Subjects')),
                              VerticalDivider(
                                width: 1,
                                thickness: 1,
                                color: colorScheme.outlineVariant,
                              ),
                              Expanded(child: _buildStat(context, leaveCount, 'Leaves')),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // ── Contact Information ──
                      Text(
                        'Contact Information',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.1,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        decoration: BoxDecoration(
                          color: colorScheme.surface,
                          border: Border.all(color: colorScheme.outlineVariant),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          children: [
                            _buildInfoRow(
                              context,
                              icon: Icons.email_outlined,
                              label: 'Email',
                              value: email,
                            ),
                            Divider(
                              height: 1,
                              thickness: 1,
                              color: colorScheme.outlineVariant,
                            ),
                            _buildInfoRow(
                              context,
                              icon: Icons.phone_outlined,
                              label: 'Phone',
                              value: phone,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // ── Settings Section ──
                      Text(
                        'Settings',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.1,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        decoration: BoxDecoration(
                          color: colorScheme.surface,
                          border: Border.all(color: colorScheme.outlineVariant),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          children: [
                            _buildMenuTile(
                              context,
                              icon: Icons.person_outline,
                              title: 'Edit Profile',
                              onTap: () {},
                            ),
                            Divider(
                              height: 1,
                              thickness: 1,
                              color: colorScheme.outlineVariant,
                            ),
                            _buildMenuTile(
                              context,
                              icon: Icons.lock_outline,
                              title: 'Change Password',
                              onTap: () {},
                            ),
                            Divider(
                              height: 1,
                              thickness: 1,
                              color: colorScheme.outlineVariant,
                            ),
                            _buildMenuTile(
                              context,
                              icon: Icons.notifications_outlined,
                              title: 'Notifications',
                              onTap: () {},
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // ── Logout Button ──
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => _showLogoutDialog(context),
                          icon: const Icon(Icons.logout, size: 18),
                          label: const Text('Sign Out'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: colorScheme.error,
                            side: BorderSide(color: colorScheme.error.withOpacity(0.5)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildStat(BuildContext context, String value, String label) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: colorScheme.primary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: theme.textTheme.labelMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colorScheme.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Icon(icon, size: 20, color: colorScheme.primary),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colorScheme.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Icon(icon, size: 20, color: colorScheme.primary),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                title,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right,
              size: 20,
              color: colorScheme.onSurfaceVariant,
            ),
          ],
        ),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(color: colorScheme.onSurfaceVariant),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              GetStorage().erase();
              Get.offAll(() => LoginView());
            },
            child: Text(
              'Sign Out',
              style: TextStyle(
                color: colorScheme.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
