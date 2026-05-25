import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

class RoutineController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = true.obs;
  var weeklyRoutine = <int, List<dynamic>>{}.obs;
  var selectedDay = 0.obs; 

  final List<String> dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  void onInit() {
    super.onInit();
    selectedDay.value = DateTime.now().weekday % 7; // 0=Sun..6=Sat
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _storage.read('token');
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        return handler.next(options);
      },
    ));
    fetchRoutine();
  }

  Future<void> fetchRoutine() async {
    isLoading.value = true;
    try {
      final res = await _dio.get('/routine');
      final rawRoutine = res.data['routine'] as List;
      
      final Map<int, List<dynamic>> grouped = {
        0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
      };
      
      for (var r in rawRoutine) {
        final day = r['dayOfWeek'] as int;
        grouped[day]?.add(r);
      }
      
      weeklyRoutine.value = grouped;
    } catch (e) {
      Get.snackbar('Error', 'Failed to fetch routine');
    } finally {
      isLoading.value = false;
    }
  }

  void selectDay(int dayIndex) {
    selectedDay.value = dayIndex;
  }
}
