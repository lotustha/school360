import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/dashboard_controller.dart';
import '../../attendance/views/attendance_view.dart';
import '../../routine/views/routine_view.dart';
import '../../gradebook/views/gradebook_view.dart';
import '../../assignments/views/assignment_view.dart';
import '../../leaves/views/leave_view.dart';
import '../../notices/views/notice_view.dart';
import '../../materials/views/material_view.dart';
import '../../profile/views/profile_view.dart';
import '../../directory/views/student_directory_view.dart';
import '../../notifications/views/notifications_view.dart';

class DashboardView extends StatelessWidget {
  final DashboardController controller = Get.put(DashboardController());

  DashboardView({super.key});

  // Design system colors
  static const _primary = Color(0xFF00475e);
  static const _primaryContainer = Color(0xFF1a5f7a);
  static const _secondary = Color(0xFF24695f);
  static const _secondaryContainer = Color(0xFFa9ede0);
  static const _tertiary = Color(0xFF623700);
  static const _tertiaryContainer = Color(0xFF834b00);
  static const _surface = Color(0xFFf8f9fa);
  static const _onSurface = Color(0xFF191c1d);
  static const _onSurfaceVariant = Color(0xFF40484d);
  static const _outline = Color(0xFF70787d);
  static const _outlineVariant = Color(0xFFc0c8cd);
  static const _cardBorder = Color(0xFFE9ECEF);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: _surface,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Obx(() => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              controller.user.isEmpty
                  ? 'Dashboard'
                  : controller.user['school']?['name'] ?? 'Dashboard',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: _onSurface,
                fontSize: 18,
              ),
            ),
          ],
        )),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: IconButton(
              icon: const Icon(Icons.notifications_outlined, size: 22),
              color: _onSurfaceVariant,
              onPressed: () => Get.to(() => NotificationsView()),
              tooltip: 'Notifications',
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: _cardBorder,
          ),
        ),
      ),
      body: Obx(() {
        if (controller.isLoading.value) {
          return Center(
            child: CircularProgressIndicator(
              color: colorScheme.primary,
              strokeWidth: 2.5,
            ),
          );
        }

        final user = controller.user;
        final routine = controller.routine;

        return RefreshIndicator(
          color: colorScheme.primary,
          onRefresh: controller.fetchDashboardData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Welcome Banner ──
                      _buildWelcomeBanner(context, user),
                      const SizedBox(height: 24),

                      // ── Quick Actions ──
                      Text(
                        'Quick Actions',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: _onSurface,
                          letterSpacing: 0.1,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _buildQuickActionsGrid(context),
                      const SizedBox(height: 24),

                      // ── Today's Schedule ──
                      _buildSectionHeader(
                        context,
                        title: "Today's Schedule",
                        actionLabel: 'View Full Routine',
                        onAction: () => Get.to(() => RoutineView()),
                      ),
                      const SizedBox(height: 12),
                      _buildRoutineList(context, routine),
                      const SizedBox(height: 24),
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

  // ── Welcome Banner ──
  Widget _buildWelcomeBanner(BuildContext context, Map user) {
    final theme = Theme.of(context);
    final firstName = (user['name'] ?? 'Teacher').toString().split(' ').first;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _cardBorder, width: 1),
      ),
      child: Column(
        children: [
          // Top accent bar
          Container(
            height: 4,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [_primary, _primaryContainer, _secondary],
              ),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(8),
                topRight: Radius.circular(8),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                // Avatar
                GestureDetector(
                  onTap: () => Get.to(() => ProfileView()),
                  child: Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: _primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        (user['name'] ?? 'T')[0].toUpperCase(),
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                // Greeting
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome back, $firstName',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: _onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _getGreetingSubtitle(),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: _onSurfaceVariant,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                // Date chip
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: _surface,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: _cardBorder, width: 1),
                  ),
                  child: Text(
                    _getFormattedDate(),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: _onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Quick Actions Grid ──
  Widget _buildQuickActionsGrid(BuildContext context) {
    final actions = [
      _QuickAction(
        icon: Icons.check_circle_outline,
        label: 'Attendance',
        color: _secondary,
        bgColor: _secondaryContainer.withOpacity(0.3),
        onTap: () => Get.to(() => AttendanceView()),
      ),
      _QuickAction(
        icon: Icons.grading_rounded,
        label: 'Gradebook',
        color: _primary,
        bgColor: _primary.withOpacity(0.08),
        onTap: () => Get.to(() => GradebookView()),
      ),
      _QuickAction(
        icon: Icons.assignment_outlined,
        label: 'Assignments',
        color: _tertiaryContainer,
        bgColor: _tertiaryContainer.withOpacity(0.08),
        onTap: () => Get.to(() => AssignmentView()),
      ),
      _QuickAction(
        icon: Icons.menu_book_outlined,
        label: 'Materials',
        color: _primaryContainer,
        bgColor: _primaryContainer.withOpacity(0.08),
        onTap: () => Get.to(() => MaterialView()),
      ),
      _QuickAction(
        icon: Icons.campaign_outlined,
        label: 'Notices',
        color: _secondary,
        bgColor: _secondaryContainer.withOpacity(0.3),
        onTap: () => Get.to(() => NoticeView()),
      ),
      _QuickAction(
        icon: Icons.event_note_outlined,
        label: 'Leaves',
        color: _tertiary,
        bgColor: _tertiary.withOpacity(0.08),
        onTap: () => Get.to(() => LeaveView()),
      ),
      _QuickAction(
        icon: Icons.people_outline_rounded,
        label: 'Directory',
        color: _primary,
        bgColor: _primary.withOpacity(0.08),
        onTap: () => Get.to(() => StudentDirectoryView()),
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 500 ? 4 : 3;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.0,
          ),
          itemCount: actions.length,
          itemBuilder: (context, index) {
            final action = actions[index];
            return _buildQuickActionTile(context, action);
          },
        );
      },
    );
  }

  Widget _buildQuickActionTile(BuildContext context, _QuickAction action) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: action.onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _cardBorder, width: 1),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: action.bgColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(action.icon, color: action.color, size: 22),
              ),
              const SizedBox(height: 8),
              Text(
                action.label,
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: _onSurface,
                  fontSize: 11,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Section Header ──
  Widget _buildSectionHeader(
    BuildContext context, {
    required String title,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: _onSurface,
            letterSpacing: 0.1,
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: _primary,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: theme.textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(actionLabel),
                const SizedBox(width: 2),
                const Icon(Icons.arrow_forward, size: 14),
              ],
            ),
          ),
      ],
    );
  }

  // ── Routine List ──
  Widget _buildRoutineList(BuildContext context, List routine) {
    final theme = Theme.of(context);

    if (routine.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _cardBorder, width: 1),
        ),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: _surface,
                borderRadius: BorderRadius.circular(28),
              ),
              child: const Icon(
                Icons.event_available_outlined,
                size: 28,
                color: _outlineVariant,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No classes scheduled today',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: _onSurfaceVariant,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Enjoy your free time!',
              style: theme.textTheme.bodySmall?.copyWith(
                color: _outline,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _cardBorder, width: 1),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: routine.length,
        separatorBuilder: (_, __) => const Divider(
          height: 1,
          thickness: 1,
          color: _cardBorder,
        ),
        itemBuilder: (context, index) {
          final item = routine[index];
          return _buildRoutineItem(context, item, index);
        },
      ),
    );
  }

  Widget _buildRoutineItem(BuildContext context, Map item, int index) {
    final theme = Theme.of(context);
    final subjectName = item['subject']?['name'] ?? 'Class';
    final className = item['class']?['name'] ?? '';
    final startTime = item['periodSlot']?['startTime'] ?? '';
    final endTime = item['periodSlot']?['endTime'] ?? '';

    // Alternate subtle accent colors for period indicators
    final accentColors = [_primary, _secondary, _tertiaryContainer];
    final accent = accentColors[index % accentColors.length];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Period indicator
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accent.withOpacity(0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                '${index + 1}',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: accent,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Subject & class info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subjectName,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: _onSurface,
                  ),
                ),
                if (className.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    className,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: _onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Time badge
          if (startTime.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: _surface,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: _cardBorder, width: 1),
              ),
              child: Text(
                endTime.isNotEmpty ? '$startTime – $endTime' : startTime,
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: _onSurfaceVariant,
                  fontSize: 11,
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Helpers ──
  String _getGreetingSubtitle() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning! Ready for a productive day.';
    if (hour < 17) return 'Good afternoon! Keep up the great work.';
    return 'Good evening! Hope you had a great day.';
  }

  String _getFormattedDate() {
    final now = DateTime.now();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }
}

// ── Data class for Quick Actions ──
class _QuickAction {
  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.onTap,
  });
}
