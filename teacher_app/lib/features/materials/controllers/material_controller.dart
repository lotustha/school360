import 'package:get/get.dart';
import 'package:dio/dio.dart' as d;
import 'package:get_storage/get_storage.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';

class MaterialController extends GetxController {
  final d.Dio _dio = d.Dio(d.BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = false.obs;
  var isSaving = false.obs;
  var materials = [].obs;

  final titleController = TextEditingController();
  var selectedFile = Rxn<PlatformFile>();

  // Use routine data to pick class/subject to attach material to
  var subjects = [].obs;
  var selectedSubjectId = ''.obs;
  var selectedClassId = ''.obs;

  @override
  void onInit() {
    super.onInit();
    fetchMaterials();
    fetchSubjects();
  }

  Future<void> fetchSubjects() async {
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/gradebook', options: d.Options(headers: {'Authorization': 'Bearer $token'}));
      subjects.value = response.data['subjects'];
    } catch (e) {}
  }

  Future<void> fetchMaterials() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/materials', options: d.Options(headers: {'Authorization': 'Bearer $token'}));
      materials.value = response.data;
    } catch (e) {
      Get.snackbar('Error', 'Failed to load materials');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> pickFile() async {
    FilePickerResult? result = await FilePicker.pickFiles(type: FileType.any);
    if (result != null) {
      selectedFile.value = result.files.first;
    }
  }

  Future<void> uploadMaterial() async {
    if (titleController.text.trim().isEmpty || selectedFile.value == null || selectedSubjectId.value.isEmpty) {
      Get.snackbar('Error', 'Please fill all fields and select a file');
      return;
    }
    isSaving.value = true;
    try {
      final token = _storage.read('token');
      d.FormData formData = d.FormData.fromMap({
        'title': titleController.text,
        'classId': selectedClassId.value,
        'subjectId': selectedSubjectId.value,
        'file': d.MultipartFile.fromBytes(
          selectedFile.value!.bytes!,
          filename: selectedFile.value!.name,
        ),
      });

      await _dio.post('/materials', data: formData, options: d.Options(headers: {'Authorization': 'Bearer $token'}));
      Get.back();
      Get.snackbar('Success', 'Material uploaded successfully');
      titleController.clear();
      selectedFile.value = null;
      fetchMaterials();
    } catch (e) {
      Get.snackbar('Error', 'Failed to upload material');
    } finally {
      isSaving.value = false;
    }
  }

  Future<void> downloadFile(String url) async {
    final fullUrl = 'http://localhost:3000$url';
    if (!await launchUrl(Uri.parse(fullUrl))) {
      Get.snackbar('Error', 'Could not open file');
    }
  }
}
