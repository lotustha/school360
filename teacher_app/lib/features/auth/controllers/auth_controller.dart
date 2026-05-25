import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import '../views/school_selection_view.dart';
import '../../layout/views/main_layout_view.dart';
import '../../../main.dart';

class AuthController extends GetxController {
  // Use 10.0.2.2 for Android emulator to access localhost
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  final identifierController = TextEditingController();
  final passwordController = TextEditingController();
  
  var isLoading = false.obs;
  var obscurePassword = true.obs;

  void togglePassword() => obscurePassword.value = !obscurePassword.value;

  Future<void> login() async {
    if (identifierController.text.isEmpty || passwordController.text.isEmpty) {
      Get.snackbar('Error', 'Please fill in all fields', backgroundColor: Colors.red.shade400, colorText: Colors.white);
      return;
    }

    isLoading.value = true;
    try {
      final response = await _dio.post('/auth/login', data: {
        'identifier': identifierController.text,
        'password': passwordController.text,
      });

      if (response.data['requiresSchoolSelection'] == true) {
        Get.to(() => SchoolSelectionView(schools: response.data['schools']));
      } else {
        await _handleSuccessfulLogin(response.data);
      }
    } on DioException catch (e) {
      Get.snackbar('Login Failed', e.response?.data['error'] ?? 'Network error', backgroundColor: Colors.red.shade400, colorText: Colors.white);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loginWithSchool(String schoolId) async {
    isLoading.value = true;
    try {
      final response = await _dio.post('/auth/login', data: {
        'identifier': identifierController.text,
        'password': passwordController.text,
        'selectedSchoolId': schoolId,
      });

      await _handleSuccessfulLogin(response.data);
    } on DioException catch (e) {
      Get.snackbar('Login Failed', e.response?.data['error'] ?? 'Network error', backgroundColor: Colors.red.shade400, colorText: Colors.white);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> _handleSuccessfulLogin(Map<String, dynamic> data) async {
    await _storage.write('token', data['token']);
    final user = data['user'];
    final school = user['school'];
    
    if (school != null && school['themeColor'] != null) {
      await _storage.write('themeColor', school['themeColor']);
      updateAppTheme(school['themeColor']);
    }
    
    Get.snackbar('Success', 'Welcome back, ${user['name']}', backgroundColor: Colors.green.shade400, colorText: Colors.white);
    
    Get.offAll(() => MainLayoutView());
  }
}
