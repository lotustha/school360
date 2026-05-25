import 'package:get/get.dart';
import 'package:dio/dio.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter/material.dart';

class DirectoryController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = true.obs;
  var searchQuery = ''.obs;
  var students = <Map<String, dynamic>>[].obs;

  @override
  void onInit() {
    super.onInit();
    fetchDirectory();
  }

  Future<void> fetchDirectory() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/directory', options: Options(headers: {'Authorization': 'Bearer $token'}));
      students.assignAll(List<Map<String, dynamic>>.from(response.data));
    } on DioException catch (e) {
      Get.snackbar('Error', e.response?.data['error'] ?? 'Failed to load directory', backgroundColor: Colors.red.shade400, colorText: Colors.white);
    } finally {
      isLoading.value = false;
    }
  }

  List<Map<String, dynamic>> get filteredStudents {
    if (searchQuery.value.isEmpty) return students;
    return students.where((s) => s['name'].toString().toLowerCase().contains(searchQuery.value.toLowerCase())).toList();
  }

  void updateSearch(String query) {
    searchQuery.value = query;
  }
}
