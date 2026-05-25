import 'package:get/get.dart';
import 'package:dio/dio.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter/material.dart';

class MessagingController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = true.obs;
  var conversations = <Map<String, dynamic>>[].obs;

  @override
  void onInit() {
    super.onInit();
    fetchConversations();
  }

  Future<void> fetchConversations() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/messaging', options: Options(headers: {'Authorization': 'Bearer $token'}));
      conversations.assignAll(List<Map<String, dynamic>>.from(response.data));
    } on DioException catch (e) {
      Get.snackbar('Error', e.response?.data['error'] ?? 'Failed to load messages', backgroundColor: Colors.red.shade400, colorText: Colors.white);
    } finally {
      isLoading.value = false;
    }
  }
}
