// ============================================================
//  إعدادات Firebase — لازم تعبّينها قبل ما يشتغل الموقع
// ============================================================
//
// الموقع يحتاج قاعدة بيانات حقيقية تتشارك بين كل الحافظات والمشرفة
// من أي جهاز (عشان المتصدرات، النقاط، الاختبارات كلها تكون مشتركة).
// أسهل وأسرع طريقة مجانية 100% هي Firebase من قوقل. اتبعي الخطوات:
//
// 1) روحي https://console.firebase.google.com وسجلي دخول بحساب Google
// 2) اضغطي "إضافة مشروع" (Add project) واختاري أي اسم (مثلاً: hifth-course)
//    عطلي خانة Google Analytics (مو لازمة) واستمري لين يخلص إنشاء المشروع
// 3) من القائمة الجانبية: Build > Authentication > ابدئي (Get started)
//    فعّلي طريقة الدخول "Email/Password" (بريد إلكتروني/كلمة مرور) فقط، وفعّليها
// 4) من القائمة الجانبية: Build > Firestore Database > إنشاء قاعدة بيانات
//    اختاري "Start in production mode" ثم أي موقع سيرفر قريب (مثلاً eur3)
// 5) بعد إنشاء القاعدة، افتحي تبويب "Rules" داخل Firestore والصقي فيه
//    محتوى ملف firestore.rules المرفق معك، واضغطي Publish
// 6) ارجعي لإعدادات المشروع (⚙️ بجانب Project Overview) > Project settings
//    انزلي لقسم "Your apps" واضغطي أيقونة الويب </> لإضافة تطبيق ويب جديد
//    أعطيه أي اسم واضغطي تسجيل (Register app)
// 7) بيطلع لك كائن (object) فيه apiKey و authDomain وغيرها — انسخيه كامل
//    وحطيه مكان الكائن اللي تحت بدل القيم الوهمية
//
// بعد هالخطوات (تاخذ ٥ دقائق) الموقع بيشتغل بشكل كامل ومباشر.
// ============================================================

const firebaseConfig = {
  apiKey: "ضعي-هنا-قيمة-apiKey",
  authDomain: "ضعي-هنا-قيمة-authDomain",
  projectId: "ضعي-هنا-قيمة-projectId",
  storageBucket: "ضعي-هنا-قيمة-storageBucket",
  messagingSenderId: "ضعي-هنا-قيمة-messagingSenderId",
  appId: "ضعي-هنا-قيمة-appId",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
