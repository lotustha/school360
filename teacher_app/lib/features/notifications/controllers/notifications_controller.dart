import 'package:get/get.dart';
import 'package:dio/dio.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter/material.dart';

class NotificationsController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = true.obs;
  var notifications = <Map<String, dynamic>>[].obs;

  @override
  void onInit() {
    super.onInit();
    fetchNotifications();
  }

  Future<void> fetchNotifications() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/notifications', options: Options(headers: {'Authorization': 'Bearer $token'}));
      notifications.assignAll(List<Map<String, dynamic>>.from(response.data));
    } on DioException catch (e) {
      Get.snackbar('Error', e.response?.data['error'] ?? 'Failed to load notifications', backgroundColor: Colors.red.shade400, colorText: Colors.white);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> markAllAsRead() async {
    try {
      final token = _storage.read('token');
      await _dio.put('/notifications', options: Options(headers: {'Authorization': 'Bearer $token'}));
      
      for (var i = 0; i < notifications.length; i++) {
        notifications[i]['isRead'] = true;
      }
      notifications.refresh();
      
      Get.snackbar('Success', 'Marked all as read', backgroundColor: Colors.green.shade400, colorText: Colors.white);
    } on DioException catch (e) {
      Get.snackbar('Error', e.response?.data['error'] ?? 'Failed to update', backgroundColor: Colors.red.shade400, colorText: Colors.white);
    }
  }
}
