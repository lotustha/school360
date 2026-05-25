import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

class AttendanceController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = false.obs;
  var isSaving = false.obs;
  var hasError = ''.obs;
  
  var selectedClassId = ''.obs;
  var classes = <Map<String, dynamic>>[].obs; 
  var selectedDateBS = ''.obs; 
  var selectedDateAD = DateTime.now().obs;

  var students = <Map<String, dynamic>>[].obs;
  var attendanceRecords = <String, String>{}.obs; 

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
    selectedDateBS.value = _adToApproxBS(DateTime.now());
    _fetchClasses();
  }

  String _adToApproxBS(DateTime ad) {
    final bsYear = ad.month < 4 || (ad.month == 4 && ad.day < 14)
        ? ad.year + 56
        : ad.year + 57;
    const monthMap = {
      1: 10, 2: 11, 3: 12, 4: 1, 5: 2, 6: 3,
      7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9
    };
    final bsMonth = monthMap[ad.month] ?? 1;
    final bsDay = ad.day > 30 ? 30 : ad.day;
    return '$bsYear-${bsMonth.toString().padLeft(2, '0')}-${bsDay.toString().padLeft(2, '0')}';
  }

  Future<void> _fetchClasses() async {
    isLoading.value = true;
    hasError.value = '';
    try {
      final routineRes = await _dio.get('/routine');
      final routine = routineRes.data['routine'] as List? ?? [];
      final uniqueClasses = <String, Map<String, dynamic>>{};
      for (var r in routine) {
        if (r['class'] != null) {
          final cls = Map<String, dynamic>.from(r['class']);
          uniqueClasses[cls['id']] = cls;
        }
      }
      classes.assignAll(uniqueClasses.values.toList());

      if (classes.isNotEmpty) {
        selectedClassId.value = classes.first['id'];
        await fetchStudents();
      } else {
        isLoading.value = false;
      }
    } catch (e) {
      hasError.value = 'Failed to load classes. Pull down to retry.';
      isLoading.value = false;
    }
  }

  Future<void> fetchStudents() async {
    if (selectedClassId.isEmpty) return;
    
    isLoading.value = true;
    hasError.value = '';
    try {
      final res = await _dio.get('/attendance', queryParameters: {
        'classId': selectedClassId.value,
        'dateBS': selectedDateBS.value,
      });
      
      final studentList = (res.data['students'] as List? ?? []);
      students.assignAll(studentList.map((s) => Map<String, dynamic>.from(s)));

      final existingRecords = (res.data['attendances'] as List?) ?? [];
      
      final newRecords = <String, String>{};
      for (var s in students) {
        newRecords[s['id']] = 'PRESENT';
      }
      for (var r in existingRecords) {
        newRecords[r['studentId']] = r['status'];
      }
      attendanceRecords.assignAll(newRecords);
    } catch (e) {
      hasError.value = 'Failed to load students.';
    } finally {
      isLoading.value = false;
    }
  }

  void updateStatus(String studentId, String status) {
    attendanceRecords[studentId] = status;
    attendanceRecords.refresh(); 
  }

  void markAllPresent() {
    for (var s in students) {
      attendanceRecords[s['id']] = 'PRESENT';
    }
    attendanceRecords.refresh();
  }

  Future<void> saveAttendance() async {
    if (selectedClassId.isEmpty || students.isEmpty) return;

    isSaving.value = true;
    try {
      final records = students.map((s) => ({
        'studentId': s['id'],
        'status': attendanceRecords[s['id']] ?? 'PRESENT',
        'note': '',
      })).toList();

      await _dio.post('/attendance', data: {
        'classId': selectedClassId.value,
        'dateBS': selectedDateBS.value,
        'dateAD': selectedDateAD.value.toIso8601String(),
        'records': records,
      });

      Get.snackbar('Success', 'Attendance saved successfully',
          backgroundColor: Colors.green.shade400, colorText: Colors.white);
    } catch (e) {
      Get.snackbar('Error', 'Failed to save attendance',
          backgroundColor: Colors.red.shade400, colorText: Colors.white);
    } finally {
      isSaving.value = false;
    }
  }
}
