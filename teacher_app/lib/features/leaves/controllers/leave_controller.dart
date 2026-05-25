import 'package:get/get.dart';
import 'package:dio/dio.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter/material.dart';

class LeaveController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = false.obs;
  var isSaving = false.obs;
  var leaves = [].obs;

  final reasonController = TextEditingController();
  var startDate = DateTime.now().obs;
  var endDate = DateTime.now().add(const Duration(days: 1)).obs;

  @override
  void onInit() {
    super.onInit();
    fetchLeaves();
  }

  Future<void> fetchLeaves() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/leaves', options: Options(headers: {'Authorization': 'Bearer $token'}));
      leaves.value = response.data;
    } catch (e) {
      Get.snackbar('Error', 'Failed to load leaves');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> applyLeave() async {
    if (reasonController.text.trim().isEmpty) {
      Get.snackbar('Error', 'Please enter a reason');
      return;
    }
    isSaving.value = true;
    try {
      final token = _storage.read('token');
      await _dio.post(
        '/leaves',
        data: {
          'startDate': startDate.value.toIso8601String(),
          'endDate': endDate.value.toIso8601String(),
          'reason': reasonController.text,
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      Get.back();
      Get.snackbar('Success', 'Leave applied successfully');
      reasonController.clear();
      fetchLeaves();
    } catch (e) {
      Get.snackbar('Error', 'Failed to apply for leave');
    } finally {
      isSaving.value = false;
    }
  }
}
