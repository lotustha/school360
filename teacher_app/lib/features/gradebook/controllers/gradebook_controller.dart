import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

class GradebookController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = false.obs;
  var isSaving = false.obs;

  var exams = [].obs;
  var subjects = [].obs;
  var selectedExamId = ''.obs;
  var selectedSubjectId = ''.obs;

  var students = [].obs;
  var scores = {}.obs; 
  var absentees = {}.obs; 

  @override
  void onInit() {
    super.onInit();
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _storage.read('token');
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        return handler.next(options);
      },
    ));
    _fetchOptions();
  }

  Future<void> _fetchOptions() async {
    isLoading.value = true;
    try {
      final res = await _dio.get('/gradebook');
      exams.value = res.data['exams'];
      subjects.value = res.data['subjects'];

      if (exams.isNotEmpty) selectedExamId.value = exams.first['id'];
      if (subjects.isNotEmpty) selectedSubjectId.value = subjects.first['id'];

      if (exams.isNotEmpty && subjects.isNotEmpty) {
        fetchStudentsAndScores();
      }
    } catch (e) {
      Get.snackbar('Error', 'Failed to fetch gradebook options');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> fetchStudentsAndScores() async {
    if (selectedExamId.isEmpty || selectedSubjectId.isEmpty) return;

    isLoading.value = true;
    try {
      final res = await _dio.get('/gradebook', queryParameters: {
        'examId': selectedExamId.value,
        'subjectId': selectedSubjectId.value,
      });

      students.value = res.data['students'];
      final existingScores = res.data['scores'] as List;

      scores.clear();
      absentees.clear();

      for (var s in students) {
        scores[s['id']] = null;
        absentees[s['id']] = false;
      }

      for (var s in existingScores) {
        scores[s['studentId']] = s['rawScore'];
        absentees[s['studentId']] = s['isAbsent'];
      }
    } catch (e) {
      Get.snackbar('Error', 'Failed to fetch students');
    } finally {
      isLoading.value = false;
    }
  }

  void updateScore(String studentId, String value) {
    if (value.isEmpty) {
      scores[studentId] = null;
    } else {
      scores[studentId] = double.tryParse(value);
    }
  }

  void toggleAbsent(String studentId, bool value) {
    absentees[studentId] = value;
    absentees.refresh();
  }

  Future<void> saveScores() async {
    if (selectedExamId.isEmpty || selectedSubjectId.isEmpty || students.isEmpty) return;

    isSaving.value = true;
    try {
      final records = students.map((s) => ({
        'studentId': s['id'],
        'rawScore': scores[s['id']],
        'isAbsent': absentees[s['id']],
      })).toList();

      await _dio.post('/gradebook', data: {
        'examId': selectedExamId.value,
        'subjectId': selectedSubjectId.value,
        'records': records,
      });

      Get.snackbar('Success', 'Scores saved successfully', backgroundColor: Colors.green, colorText: Colors.white);
    } catch (e) {
      Get.snackbar('Error', 'Failed to save scores', backgroundColor: Colors.red, colorText: Colors.white);
    } finally {
      isSaving.value = false;
    }
  }
}
