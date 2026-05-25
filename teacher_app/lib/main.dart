import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/views/login_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GetStorage.init();
  runApp(const TeacherApp());
}

void updateAppTheme(String hexColor) {
  Get.changeTheme(AppTheme.getThemeFromColor(hexColor));
}

class TeacherApp extends StatelessWidget {
  const TeacherApp({super.key});

  @override
  Widget build(BuildContext context) {
    final storage = GetStorage();
    final savedThemeColor = storage.read('themeColor') as String?;

    return GetMaterialApp(
      title: 'School360 Teacher',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.getThemeFromColor(savedThemeColor ?? '#10b981'),
      home: LoginView(),
    );
  }
}
