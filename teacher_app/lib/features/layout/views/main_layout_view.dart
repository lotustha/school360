import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/main_layout_controller.dart';
import '../../dashboard/views/dashboard_view.dart';
import '../../profile/views/profile_view.dart';
import '../../planner/views/lesson_planner_view.dart';
import '../../messaging/views/messaging_view.dart';

class MainLayoutView extends StatelessWidget {
  final MainLayoutController controller = Get.put(MainLayoutController());

  MainLayoutView({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Obx(() {
        return IndexedStack(
          index: controller.selectedIndex.value,
          children: [
            DashboardView(),
            LessonPlannerView(),
            MessagingView(),
            ProfileView(),
          ],
        );
      }),
      bottomNavigationBar: Obx(() {
        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              top: BorderSide(
                color: colorScheme.outlineVariant,
                width: 1,
              ),
            ),
          ),
          child: NavigationBar(
            selectedIndex: controller.selectedIndex.value,
            onDestinationSelected: controller.changeTabIndex,
            backgroundColor: Colors.transparent,
            elevation: 0,
            indicatorColor: colorScheme.primary.withOpacity(0.1),
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            height: 64,
            destinations: [
              NavigationDestination(
                icon: Icon(Icons.dashboard_outlined,
                    color: colorScheme.onSurfaceVariant),
                selectedIcon:
                    Icon(Icons.dashboard, color: colorScheme.primary),
                label: 'Dashboard',
              ),
              NavigationDestination(
                icon: Icon(Icons.auto_stories_outlined,
                    color: colorScheme.onSurfaceVariant),
                selectedIcon:
                    Icon(Icons.auto_stories, color: colorScheme.primary),
                label: 'Planner',
              ),
              NavigationDestination(
                icon: Icon(Icons.forum_outlined,
                    color: colorScheme.onSurfaceVariant),
                selectedIcon:
                    Icon(Icons.forum, color: colorScheme.primary),
                label: 'Messages',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline,
                    color: colorScheme.onSurfaceVariant),
                selectedIcon:
                    Icon(Icons.person, color: colorScheme.primary),
                label: 'Profile',
              ),
            ],
          ),
        );
      }),
    );
  }
}
