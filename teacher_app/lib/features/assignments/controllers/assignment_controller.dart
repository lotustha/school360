import 'package:get/get.dart';
import 'package:dio/dio.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter/material.dart';

class AssignmentController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = false.obs;
  var isSaving = false.obs;
  var assignments = [].obs;

  final titleController = TextEditingController();
  final descController = TextEditingController();
  var dueDate = DateTime.now().add(const Duration(days: 7)).obs;

  var subjects = [].obs;
  var selectedSubjectId = ''.obs;
  var selectedClassId = ''.obs;

  @override
  void onInit() {
    super.onInit();
    fetchAssignments();
    fetchSubjects();
  }

  Future<void> fetchSubjects() async {
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/gradebook', options: Options(headers: {'Authorization': 'Bearer $token'}));
      subjects.value = response.data['subjects'];
    } catch (e) {}
  }

  Future<void> fetchAssignments() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/assignments', options: Options(headers: {'Authorization': 'Bearer $token'}));
      assignments.value = response.data;
    } catch (e) {
      Get.snackbar('Error', 'Failed to load assignments');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> createAssignment() async {
    if (titleController.text.trim().isEmpty || selectedSubjectId.value.isEmpty) {
      Get.snackbar('Error', 'Please fill all required fields');
      return;
    }
    isSaving.value = true;
    try {
      final token = _storage.read('token');
      await _dio.post(
        '/assignments',
        data: {
          'title': titleController.text,
          'description': descController.text,
          'dueDate': dueDate.value.toIso8601String(),
          'classId': selectedClassId.value,
          'subjectId': selectedSubjectId.value,
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      Get.back();
      Get.snackbar('Success', 'Assignment created successfully');
      titleController.clear();
      descController.clear();
      fetchAssignments();
    } catch (e) {
      Get.snackbar('Error', 'Failed to create assignment');
    } finally {
      isSaving.value = false;
    }
  }
}
