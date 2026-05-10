import { createContext, createElement, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export type Lang = "ar" | "en";

const LS_KEY = "obour.lang";

type Dict = Record<string, string>;

const AR: Dict = {
  // App
  "app.title": "لوحة شبكات مرافق العبور الجديدة",
  "app.subtitle": "Executive GIS Dashboard · مشروع التحول الرقمي",
  "app.brand_letter": "ع",
  // Tabs
  "tab.overview": "نظرة عامة",
  "tab.networks": "الشبكات (مجمع)",
  // Header actions
  "action.download_zip": "تحميل الملفات ZIP",
  "action.downloading": "جاري التحميل...",
  "action.lang_toggle": "EN",
  // Navigation
  "nav.back_to": "رجوع إلى",
  "nav.networks": "الشبكات",
  // Loading / states
  "state.loading": "جاري تحميل البيانات...",
  "state.loading_network": "جاري تحميل {name}...",
  "state.loading_networks": "جاري تحميل {n}/{total} شبكات...",
  "state.no_data_material": "لا توجد بيانات للخامة",
  "state.no_data_diameter": "لا توجد بيانات للقطر",
  "state.no_data": "لا توجد بيانات",
  // Stat labels
  "stat.total_sectors": "إجمالي القطاعات",
  "stat.delivered_sectors": "قطاعات تم تسليمها",
  "stat.remaining_sectors": "القطاعات المتبقية",
  "stat.field_progress": "جاري العمل (ميدانياً)",
  "stat.office_progress": "جاري العمل (مكتبياً)",
  "stat.total_roads": "إجمالي طرق المدينة",
  "stat.delivered_roads": "إجمالي إنجاز الطرق",
  "stat.remaining_roads": "الطرق المتبقية",
  "stat.total_elements": "إجمالي العناصر",
  "stat.total_network_elements": "إجمالي عناصر الشبكات",
  "stat.total_lengths": "إجمالي الأطوال",
  "stat.total_lengths_all": "إجمالي الأطوال (كل الشبكات)",
  "stat.lines": "الخطوط (مواسير/كابلات)",
  "stat.lines_count": "عدد الخطوط (مواسير/كابلات)",
  "stat.points": "النقاط (محابس/أكشاك)",
  "stat.points_count": "عدد النقاط (محابس/أكشاك...)",
  "stat.cable_lengths": "أطوال الكابلات",
  "stat.electric_points": "أعمدة / أكشاك / نقاط",
  "stat.electric_lines": "كابلات / خطوط",
  "stat.gas_lines": "خطوط الغاز",
  "stat.control_points": "نقاط التحكم",
  "stat.valves": "المحابس",
  "stat.rooms": "الغرف",
  "stat.sizes_count": "عدد المقاسات",
  "stat.rooms_points": "غرف / نقاط",
  "stat.equipment_points": "معدات / نقاط",
  "stat.irrigation_rooms": "غرف الري",
  // Card titles
  "card.sectors": "القطاعات",
  "card.sector_progress": "نسبة إنجاز القطاعات",
  "card.road_progress": "نسبة إنجاز الطرق (كم)",
  "card.road_classification": "تصنيف الطرق",
  "card.roads_by_district": "الطرق حسب الحي",
  "card.top_road_sectors": "أكثر القطاعات (كم طرق)",
  "card.networks_toggle": "الشبكات (انقر للتفعيل)",
  "card.network_distribution": "توزيع العناصر حسب الشبكة",
  "card.network_radar": "مقارنة الشبكات (رادار)",
  "card.lengths_by_network": "الأطوال حسب الشبكة (كم)",
  "card.top_implementing": "الأكثر تنفيذاً (الجهات)",
  "card.network_share": "حصة الشبكات بالنوع",
  "card.by_type": "حسب النوع",
  "card.elements_detail": "تفاصيل عناصر الشبكة",
  "card.by_sector_top": "حسب القطاع (top {n})",
  "card.implementing_parties": "الجهات المنفذة",
  "card.by_material": "حسب الخامة",
  "card.by_diameter": "حسب القطر / المقاس",
  "card.by_size": "حسب المقاس",
  "card.lengths_by_cable_type": "الأطوال حسب نوع الكابل",
  "card.lengths_by_line_type": "الأطوال حسب نوع الخط",
  "card.equipment_types": "أنواع المعدات",
  "card.irrigation_room_types": "أنواع غرف الري",
  "card.line_point_share": "نسبة خطوط / نقاط",
  "biz.asset_mix": "تركيب أصول الشبكة",
  "biz.top_service_areas": "أهم مناطق الخدمة",
  "biz.critical_assets": "الأصول المؤثرة",
  "biz.electric_voltage_lengths": "أطوال الكابلات حسب الجهد",
  "biz.electric_assets": "مكونات الشبكة الكهربائية",
  "biz.service_density": "كثافة الخدمة",
  "biz.medium_voltage": "جهد متوسط",
  "biz.low_voltage": "جهد منخفض",
  "biz.lighting_cables": "كابلات إنارة",
  "biz.building_feeds": "تغذية عمارات",
  "biz.lighting_poles": "أعمدة إنارة",
  "biz.cable_boxes": "كوفريات",
  "biz.pillars": "بيلرات",
  "biz.kiosks": "أكشاك",
  "biz.stations": "محطات",
  "biz.service_points": "نقاط خدمة وتحكم",
  "biz.cable_lines": "كابلات وخطوط",
  "biz.gas_line_distribution": "توزيع خطوط الغاز",
  "biz.gas_safety_points": "نقاط التحكم والسلامة",
  "biz.reducers": "مخفضات",
  "biz.endcaps": "إيندكاب",
  "biz.material_readiness": "الخامة المستخدمة",
  "biz.water_capacity_diameters": "الأقطار الأكثر استخدامًا",
  "biz.water_operation_assets": "عناصر التشغيل والصيانة",
  "biz.fire_hydrants": "صنابير حريق",
  "biz.house_connections": "توصيلات منزلية",
  "biz.sewage_load_diameters": "أقطار خطوط الصرف",
  "biz.sewage_access_assets": "المطابق والغرف",
  "biz.square_manholes": "مطابق مربعة",
  "biz.round_manholes": "مطابق دائرية",
  "biz.storm_drains": "بلاعات مطر",
  "biz.contractor_distribution": "توزيع التنفيذ حسب الجهة",
  "biz.telecom_structure": "هيكل شبكة الاتصالات",
  "biz.telecom_service_equipment": "معدات الخدمة",
  "biz.telecom_capacity": "سعة الكبائن/البوكسات",
  "biz.boxes": "بوكسات",
  "biz.connectors": "كونيكتورات",
  "biz.joints": "جوينتات",
  "biz.cabinets": "كبائن",
  "biz.passive": "باسيف",
  "biz.irrigation_capacity_diameters": "أقطار خطوط الري",
  "biz.irrigation_control_points": "نقاط التحكم في الري",
  "biz.execution_readiness": "جاهزية المرافق",
  "biz.incomplete_sectors": "قطاعات ناقصة المرافق",
  "biz.priority_sectors": "أولويات التنفيذ حسب القطاع",
  "biz.coverage_matrix": "مصفوفة تغطية القطاعات",
  "biz.top_execution_load": "أعلى جهة تحملًا للتنفيذ",
  "biz.critical_networks": "شبكات حرجة للمتابعة",
  "biz.execution_pressure": "ضغط التنفيذ والمتابعة",
  "biz.incomplete_only": "الناقص فقط",
  "biz.coverage": "التغطية",
  "biz.present": "موجود",
  "biz.missing": "ناقص",
  "biz.length_only": "أطوال فقط",
  "biz.points_only": "نقاط فقط",
  "biz.follow_up_networks": "شبكات تحتاج متابعة",
  "card.elements_table": "جدول كل العناصر",
  // Filters
  "filter.sector": "القطاع",
  "filter.type": "النوع",
  "filter.implementing": "المنفذ",
  "filter.material": "الخامة",
  "filter.diameter": "القطر / المقاس",
  "filter.all": "الكل",
  "filter.search": "بحث...",
  "filter.search_features": "ابحث عن عنصر، قطاع، نوع، منفذ...",
  "filter.search_sector": "ابحث عن قطاع...",
  "filter.clear": "مسح الفلاتر",
  "filter.filtered": "مفلتر",
  "filter.results": "{n} نتيجة",
  // View toggle
  "view.map": "خريطة",
  "view.table": "جدول",
  "view.both": "خريطة + جدول",
  // Map
  "map.legend_status": "حالة التنفيذ",
  "map.legend_networks": "مفتاح الشبكات",
  "map.color_by_status": "تلوين بالحالة",
  "map.color_default": "تلوين افتراضي",
  "map.showing": "يعرض الآن",
  "map.of": "من",
  // Table
  "tbl.id": "م",
  "tbl.network": "الشبكة",
  "tbl.type": "النوع",
  "tbl.category": "التصنيف",
  "tbl.sector": "القطاع",
  "tbl.implementing": "الجهة المنفذة",
  "tbl.material": "الخامة",
  "tbl.diameter": "القطر",
  "tbl.length_km": "الطول (كم)",
  "tbl.empty": "لا توجد عناصر مطابقة",
  "tbl.locate": "تحديد على الخريطة",
  "detail.geometry_class": "التصنيف الهندسي",
  "detail.practical": "تفصيل",
  "detail.operational_class": "التصنيف العملي",
  "detail.size": "المقاس",
  "detail.electric_code": "كود عنصر كهرباء",
  "detail.gas_code": "كود عنصر غاز",
  "detail.water_code": "كود محبس/غرفة مياه",
  "detail.sewage_code": "كود خط/غرفة صرف",
  "detail.telecom_code": "كود عنصر اتصالات",
  "detail.irrigation_code": "كود غرفة ري",
  "detail.cable_or_asset_type": "نوع الكابل/العنصر",
  "detail.line_or_control_type": "نوع الخط/نقطة التحكم",
  "detail.valve_room_type": "نوع المحبس/الغرفة",
  "detail.line_room_type": "نوع الخط/الغرفة",
  "detail.equipment_line_type": "نوع المعدة/الخط",
  "detail.irrigation_room_type": "نوع غرفة الري",
  "detail.main_line": "خط رئيسي",
  "detail.secondary_line": "خط فرعي",
  "detail.feed_line": "تغذية",
  "detail.control_point": "نقطة تحكم",
  "detail.equipment": "معدة",
  "detail.room": "غرفة",
  "detail.cable": "كابل",
  "detail.medium_voltage": "جهد متوسط",
  "detail.low_voltage": "جهد منخفض",
  "detail.lighting": "إنارة",
  "detail.valve": "محبس",
  "detail.pipe_line": "خط مواسير",
  // Categories
  "cat.line": "خط",
  "cat.point": "نقطة",
  "cat.room": "غرفة",
  // Status labels
  "status.unknown": "غير محدد",
  "status.dash": "—",
  // Hover map
  "hover.status": "الحالة",
  "hover.phase": "المرحلة",
  "hover.area": "المساحة",
  "hover.sector": "القطاع",
  "hover.district": "الحي",
  "hover.length": "الطول",
  "hover.type": "النوع",
  "hover.implementing": "المنفذ",
  "hover.material": "الخامة",
  "hover.diameter": "القطر",
  "hover.road": "طريق",
  // Generic
  "g.count": "العدد",
  "g.elements": "عنصر",
  "g.km": "كم",
  "g.km2": "كم²",
  "g.types_count": "عدد الأنواع",
  "g.parties_count": "عدد الجهات",
  "g.total": "الإجمالي",
  "insight.top_sector": "أعلى قطاع",
  "insight.top3_share": "تركيز أعلى 3",
  "insight.active_sectors": "قطاعات نشطة",
  "insight.of_total": "من الإجمالي",
  "g.total_count": "إجمالي القطاعات",
  "g.total_km": "إجمالي كم",
  "g.no_name": "بدون اسم",
  "g.dash": "—",
  // Network names
  "net.electric": "شبكة الكهرباء",
  "net.gas": "شبكة الغاز",
  "net.water": "شبكة المياه",
  "net.sewage": "شبكة الصرف الصحي",
  "net.telecom": "شبكة الاتصالات",
  "net.irrigation": "شبكة الري",
  "net.electric_short": "الكهرباء",
  "net.gas_short": "الغاز",
  "net.water_short": "المياه",
  "net.sewage_short": "الصرف الصحي",
  "net.telecom_short": "الاتصالات",
  "net.irrigation_short": "الري",
};

const EN: Dict = {
  "app.title": "Obour New City Utilities Dashboard",
  "app.subtitle": "Executive GIS Dashboard · Digital Transformation",
  "app.brand_letter": "O",
  "tab.overview": "Overview",
  "tab.networks": "All Networks",
  "action.download_zip": "Download ZIP",
  "action.downloading": "Downloading...",
  "action.lang_toggle": "ع",
  "nav.back_to": "Back to",
  "nav.networks": "Networks",
  "state.loading": "Loading data...",
  "state.loading_network": "Loading {name}...",
  "state.loading_networks": "Loading {n}/{total} networks...",
  "state.no_data_material": "No material data",
  "state.no_data_diameter": "No diameter data",
  "state.no_data": "No data",
  "stat.total_sectors": "Total Sectors",
  "stat.delivered_sectors": "Delivered Sectors",
  "stat.remaining_sectors": "Remaining Sectors",
  "stat.field_progress": "In progress (Field)",
  "stat.office_progress": "In progress (Office)",
  "stat.total_roads": "Total City Roads",
  "stat.delivered_roads": "Delivered Roads",
  "stat.remaining_roads": "Remaining Roads",
  "stat.total_elements": "Total Elements",
  "stat.total_network_elements": "Total Network Elements",
  "stat.total_lengths": "Total Length",
  "stat.total_lengths_all": "Total Length (All Networks)",
  "stat.lines": "Lines (pipes/cables)",
  "stat.lines_count": "Lines (pipes/cables)",
  "stat.points": "Points (valves/cabinets)",
  "stat.points_count": "Points (valves/cabinets…)",
  "stat.cable_lengths": "Cable Lengths",
  "stat.electric_points": "Poles / Kiosks / Points",
  "stat.electric_lines": "Cables / Lines",
  "stat.gas_lines": "Gas Lines",
  "stat.control_points": "Control Points",
  "stat.valves": "Valves",
  "stat.rooms": "Rooms",
  "stat.sizes_count": "Size Count",
  "stat.rooms_points": "Rooms / Points",
  "stat.equipment_points": "Equipment / Points",
  "stat.irrigation_rooms": "Irrigation Rooms",
  "card.sectors": "Sectors",
  "card.sector_progress": "Sector Delivery Progress",
  "card.road_progress": "Road Delivery Progress (km)",
  "card.road_classification": "Road Classification",
  "card.roads_by_district": "Roads by District",
  "card.top_road_sectors": "Top Sectors by Road km",
  "card.networks_toggle": "Networks (click to toggle)",
  "card.network_distribution": "Element Distribution by Network",
  "card.network_radar": "Network Comparison (Radar)",
  "card.lengths_by_network": "Length by Network (km)",
  "card.top_implementing": "Top Implementing Parties",
  "card.network_share": "Network Share by Type",
  "card.by_type": "By Type",
  "card.elements_detail": "Network Elements Detail",
  "card.by_sector_top": "By Sector (top {n})",
  "card.implementing_parties": "Implementing Parties",
  "card.by_material": "By Material",
  "card.by_diameter": "By Diameter / Size",
  "card.by_size": "By Size",
  "card.lengths_by_cable_type": "Length by Cable Type",
  "card.lengths_by_line_type": "Length by Line Type",
  "card.equipment_types": "Equipment Types",
  "card.irrigation_room_types": "Irrigation Room Types",
  "card.line_point_share": "Line / Point Share",
  "biz.asset_mix": "Network Asset Mix",
  "biz.top_service_areas": "Top Service Areas",
  "biz.critical_assets": "Critical Assets",
  "biz.electric_voltage_lengths": "Cable Length by Voltage",
  "biz.electric_assets": "Electric Network Components",
  "biz.service_density": "Service Density",
  "biz.medium_voltage": "Medium Voltage",
  "biz.low_voltage": "Low Voltage",
  "biz.lighting_cables": "Lighting Cables",
  "biz.building_feeds": "Building Feeds",
  "biz.lighting_poles": "Lighting Poles",
  "biz.cable_boxes": "Cable Boxes",
  "biz.pillars": "Pillars",
  "biz.kiosks": "Kiosks",
  "biz.stations": "Stations",
  "biz.service_points": "Service / Control Points",
  "biz.cable_lines": "Cables / Lines",
  "biz.gas_line_distribution": "Gas Line Distribution",
  "biz.gas_safety_points": "Control and Safety Points",
  "biz.reducers": "Reducers",
  "biz.endcaps": "Endcaps",
  "biz.material_readiness": "Material Used",
  "biz.water_capacity_diameters": "Most Used Diameters",
  "biz.water_operation_assets": "Operations and Maintenance Assets",
  "biz.fire_hydrants": "Fire Hydrants",
  "biz.house_connections": "House Connections",
  "biz.sewage_load_diameters": "Sewer Line Diameters",
  "biz.sewage_access_assets": "Manholes and Rooms",
  "biz.square_manholes": "Square Manholes",
  "biz.round_manholes": "Round Manholes",
  "biz.storm_drains": "Storm Drains",
  "biz.contractor_distribution": "Execution by Contractor",
  "biz.telecom_structure": "Telecom Network Structure",
  "biz.telecom_service_equipment": "Service Equipment",
  "biz.telecom_capacity": "Cabinet / Box Capacity",
  "biz.boxes": "Boxes",
  "biz.connectors": "Connectors",
  "biz.joints": "Joints",
  "biz.cabinets": "Cabinets",
  "biz.passive": "Passive",
  "biz.irrigation_capacity_diameters": "Irrigation Line Diameters",
  "biz.irrigation_control_points": "Irrigation Control Points",
  "biz.execution_readiness": "Utilities Readiness",
  "biz.incomplete_sectors": "Incomplete Utility Sectors",
  "biz.priority_sectors": "Execution Priorities by Sector",
  "biz.coverage_matrix": "Sector Coverage Matrix",
  "biz.top_execution_load": "Highest Execution Load",
  "biz.critical_networks": "Critical Follow-up Network",
  "biz.execution_pressure": "Execution Pressure",
  "biz.incomplete_only": "Incomplete only",
  "biz.coverage": "Coverage",
  "biz.present": "Present",
  "biz.missing": "Missing",
  "biz.length_only": "Length only",
  "biz.points_only": "Points only",
  "biz.follow_up_networks": "Networks to follow up",
  "card.elements_table": "All Elements Table",
  "filter.sector": "Sector",
  "filter.type": "Type",
  "filter.implementing": "Party",
  "filter.material": "Material",
  "filter.diameter": "Diameter / Size",
  "filter.all": "All",
  "filter.search": "Search...",
  "filter.search_features": "Search features, sector, type, party...",
  "filter.search_sector": "Search sectors...",
  "filter.clear": "Clear filters",
  "filter.filtered": "filtered",
  "filter.results": "{n} results",
  "view.map": "Map",
  "view.table": "Table",
  "view.both": "Map + Table",
  "map.legend_status": "Delivery Status",
  "map.legend_networks": "Networks legend",
  "map.color_by_status": "Color by status",
  "map.color_default": "Default color",
  "map.showing": "Showing",
  "map.of": "of",
  "tbl.id": "#",
  "tbl.network": "Network",
  "tbl.type": "Type",
  "tbl.category": "Category",
  "tbl.sector": "Sector",
  "tbl.implementing": "Party",
  "tbl.material": "Material",
  "tbl.diameter": "Diameter",
  "tbl.length_km": "Length (km)",
  "tbl.empty": "No matching elements",
  "tbl.locate": "Locate on map",
  "detail.geometry_class": "Geometry Class",
  "detail.practical": "Detail",
  "detail.operational_class": "Operational Class",
  "detail.size": "Size",
  "detail.electric_code": "Electric Element Code",
  "detail.gas_code": "Gas Element Code",
  "detail.water_code": "Water Valve/Room Code",
  "detail.sewage_code": "Sewage Line/Room Code",
  "detail.telecom_code": "Telecom Element Code",
  "detail.irrigation_code": "Irrigation Room Code",
  "detail.cable_or_asset_type": "Cable/Asset Type",
  "detail.line_or_control_type": "Line/Control Type",
  "detail.valve_room_type": "Valve/Room Type",
  "detail.line_room_type": "Line/Room Type",
  "detail.equipment_line_type": "Equipment/Line Type",
  "detail.irrigation_room_type": "Irrigation Room Type",
  "detail.main_line": "Main line",
  "detail.secondary_line": "Secondary line",
  "detail.feed_line": "Feed line",
  "detail.control_point": "Control point",
  "detail.equipment": "Equipment",
  "detail.room": "Room",
  "detail.cable": "Cable",
  "detail.medium_voltage": "Medium voltage",
  "detail.low_voltage": "Low voltage",
  "detail.lighting": "Lighting",
  "detail.valve": "Valve",
  "detail.pipe_line": "Pipe line",
  "cat.line": "Line",
  "cat.point": "Point",
  "cat.room": "Room",
  "status.unknown": "Unknown",
  "status.dash": "—",
  "hover.status": "Status",
  "hover.phase": "Phase",
  "hover.area": "Area",
  "hover.sector": "Sector",
  "hover.district": "District",
  "hover.length": "Length",
  "hover.type": "Type",
  "hover.implementing": "Party",
  "hover.material": "Material",
  "hover.diameter": "Diameter",
  "hover.road": "Road",
  "g.count": "Count",
  "g.elements": "elements",
  "g.km": "km",
  "g.km2": "km²",
  "g.types_count": "Type count",
  "g.parties_count": "Party count",
  "g.total": "Total",
  "insight.top_sector": "Top sector",
  "insight.top3_share": "Top 3 share",
  "insight.active_sectors": "Active sectors",
  "insight.of_total": "of total",
  "g.total_count": "Total Sectors",
  "g.total_km": "Total km",
  "g.no_name": "No name",
  "g.dash": "—",
  "net.electric": "Electricity Network",
  "net.gas": "Gas Network",
  "net.water": "Water Network",
  "net.sewage": "Sewage Network",
  "net.telecom": "Telecom Network",
  "net.irrigation": "Irrigation Network",
  "net.electric_short": "Electricity",
  "net.gas_short": "Gas",
  "net.water_short": "Water",
  "net.sewage_short": "Sewage",
  "net.telecom_short": "Telecom",
  "net.irrigation_short": "Irrigation",
};

const DICT: Record<Lang, Dict> = { ar: AR, en: EN };

// -------- Data value translations (Arabic source → English) --------

const SECTOR_NUM: Record<string, string> = {
  "الأول": "1", "الاول": "1",
  "الثاني": "2", "الثانى": "2",
  "الثالث": "3",
  "الرابع": "4",
  "الخامس": "5",
  "السادس": "6",
  "السابع": "7",
  "الثامن": "8",
  "التاسع": "9",
  "العاشر": "10",
  "الحادي عشر": "11", "الحادى عشر": "11",
  "الثاني عشر": "12", "الثانى عشر": "12",
  "الثالث عشر": "13",
  "الرابع عشر": "14",
  "الخامس عشر": "15",
  "السادس عشر": "16",
  "السابع عشر": "17",
  "الثامن عشر": "18",
  "التاسع عشر": "19",
  "العشرون": "20",
};

const PHASE_MAP: Record<string, string> = {
  "الأولى": "Phase 1",
  "الاولى": "Phase 1",
  "الثانية": "Phase 2",
  "الثالثة": "Phase 3",
  "الرابعة": "Phase 4",
  "الخامسة": "Phase 5",
  "السادسة": "Phase 6",
  "المرحلة الأولى": "Phase 1",
  "المرحلة الثانية": "Phase 2",
  "المرحلة الثالثة": "Phase 3",
  "المرحلة الرابعة": "Phase 4",
};

const STATUS_MAP: Record<string, string> = {
  "تم التسليم": "Delivered",
  "جاري العمل ميدانياً": "In progress (Field)",
  "جاري العمل ميدانيا": "In progress (Field)",
  "جاري العمل مكتبياً": "In progress (Office)",
  "جاري العمل مكتبيا": "In progress (Office)",
  "لم يتم العمل عليهم": "Not started",
  "لم يتم العمل عليه": "Not started",
};

const VALUE_MAP: Record<string, string> = {
  // Categories / road fields
  "رئيسي": "Main",
  "ثانوي": "Secondary",
  "فرعي": "Secondary",
  "تغذية منزلية": "Household feed",
  "تغذية العمارات": "Building feeds",
  "ابتداك": "Service tap",
  // Common element types
  "محبس": "Valve",
  "صنبور حريق": "Fire hydrant",
  "توصيلة منزلية": "House connection",
  "تقاطع": "Junction",
  "تقاطع و هواء": "Junction and air valve",
  "تقاطع و غسيل": "Junction and washout",
  "هواء": "Air valve",
  "غسيل": "Washout",
  "نموذج غرفة قفل و تقاطع": "Valve and junction chamber model",
  "نموذج غرفة قفل و تقاطع و غسيل": "Valve, junction and washout chamber model",
  "محبس غسيل": "Wash valve",
  "محبس هواء": "Air valve",
  "محبس ري": "Irrigation valve",
  "غرفة محبس": "Valve chamber",
  "غرفة الري": "Irrigation chamber",
  "غرفة ري": "Irrigation chamber",
  "غرفة": "Chamber",
  "غرف محبس": "Valve chambers",
  "غرف مياه": "Water chambers",
  "غرفة تفتيش": "Manhole",
  "غرفة ربط": "Connection chamber",
  "خط صرف": "Sewer line",
  "حط صرف": "Sewer line",
  "بلاعات المطر": "Storm drains",
  "مطبق مربع": "Square manhole",
  "مطبق دائري": "Round manhole",
  "أخرى": "Other",
  "اخرى": "Other",
  "درج": "Drain",
  "درجة 1": "Drain (Lvl 1)",
  "درجة 2": "Drain (Lvl 2)",
  "مخفض": "Reducer",
  "ايندكاب": "Endcap",
  "إيندكاب": "Endcap",
  "بوكس": "Box",
  "جوينت": "Joint",
  "كونيكتور": "Connector",
  "شمبر": "Chamber",
  "كبينة": "Cabinet",
  "باسيف": "Passive",
  "كشك تحت الانشاء": "Kiosk under construction",
  "كوفرية": "Cable box",
  "اعمدة الانارة": "Lighting poles",
  "أعمدة الانارة": "Lighting poles",
  "موزع كهرباء": "Electric distributor",
  "كشك": "Kiosk",
  "بيلر": "Pillar",
  "محطة الكهرباء": "Electric substation",
  "ولاعة اعمدة الانارة": "Lighting pole ignition point",
  "كابلات الجهد المتوسط": "Medium-voltage cables",
  "كابلات الجهد المنخفض": "Low-voltage cables",
  "كابلات اعمدة الانارة": "Lighting pole cables",
  // Materials
  "بولي إيثيلين عالي الكثافة (HDPE)": "HDPE Polyethylene",
  "بولى إيثيلين عالى الكثافة (HDPE)": "HDPE Polyethylene",
  "بولي إيثيلين عالي الكثافة": "HDPE",
  "بولى إيثيلين عالى الكثافة": "HDPE",
  "موسير بي في سي": "PVC pipes",
  "مواسير بي في سي": "PVC pipes",
  "PE PIPES": "PE pipes",
  "STEEL": "Steel",
  // Implementing parties (best-effort)
  "عوض": "Awad",
  "عوض خليفة": "Awad Khalifa",
  "أولاد": "Awlad",
  "اولاد": "Awlad",
  "اولاد حجازي": "Awlad Hegazy",
  "التوحيد": "Al-Tawheed",
  "السلام": "Al-Salam",
  "غاز": "Gas Co.",
  "غاز مصر": "Gas Misr",
  "شركة الكتروالهانى": "Electro El-Hany Co.",
};

// District names patterns
const DISTRICT_RE = /^الحي\s+(\S+)/;
const DISTRICT_NUM: Record<string, string> = SECTOR_NUM;

function translateValue(raw: string | undefined | null, lang: Lang): string {
  if (raw == null || raw === "") return "—";
  if (lang === "ar") return raw;
  const normalized = raw.trim();
  // direct mappings
  if (STATUS_MAP[normalized]) return STATUS_MAP[normalized];
  if (PHASE_MAP[normalized]) return PHASE_MAP[normalized];
  if (VALUE_MAP[normalized]) return VALUE_MAP[normalized];

  // Sector pattern: "القطاع الثاني عشر" → "Sector 12"
  const secMatch = normalized.match(/^القطاع\s+(.+)$/);
  if (secMatch) {
    const num = SECTOR_NUM[secMatch[1].trim()];
    if (num) return `Sector ${num}`;
    return `Sector ${secMatch[1]}`;
  }

  // District pattern: "الحي الأول" → "District 1"
  const distMatch = normalized.match(DISTRICT_RE);
  if (distMatch) {
    const num = DISTRICT_NUM[distMatch[1].trim()];
    if (num) return `District ${num}`;
    return `District ${distMatch[1]}`;
  }

  // Drain levels "درجة N"
  const drainMatch = normalized.match(/^درجة\s+(\d+)/);
  if (drainMatch) return `Drain Lvl ${drainMatch[1]}`;

  // Phase patterns "المرحلة الأولى"
  const phaseMatch = normalized.match(/^المرحلة\s+(.+)$/);
  if (phaseMatch && PHASE_MAP[phaseMatch[1].trim()]) return PHASE_MAP[phaseMatch[1].trim()];

  const waterLineMatch = normalized.match(/^خط مياه\s+(.+)$/);
  if (waterLineMatch) return `Water line ${waterLineMatch[1]}`;

  const sewerLineMatch = normalized.match(/^خط صرف\s+(.+)$/);
  if (sewerLineMatch) return `Sewer line ${sewerLineMatch[1]}`;

  const irrigationLineMatch = normalized.match(/^خط ري\s+(.+)$/);
  if (irrigationLineMatch) return `Irrigation line ${irrigationLineMatch[1]}`;

  const houseConnectionMatch = normalized.match(/^توصيلة منزلية\s+(.+)$/);
  if (houseConnectionMatch) return `House connection ${houseConnectionMatch[1]}`;

  const irrigationValveMatch = normalized.match(/^محبس ري\s+(.+)$/);
  if (irrigationValveMatch) return `Irrigation valve ${irrigationValveMatch[1]}`;

  const numericSizeMatch = normalized.match(/^(\d+(?:\.\d+)?)(?:\s*مم)?$/);
  if (numericSizeMatch) return `${numericSizeMatch[1]} mm`;

  const meterSizeMatch = normalized.match(/^(.+)\s*م$/);
  if (meterSizeMatch) return `${meterSizeMatch[1]} m`;

  return normalized;
}

// -------- React context --------

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  td: (raw: string | undefined | null) => string;
  dir: "rtl" | "ltr";
}

const I18nCtx = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ar";
    const saved = window.localStorage.getItem(LS_KEY) as Lang | null;
    return saved === "ar" || saved === "en" ? saved : "ar";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LS_KEY, l);
    } catch {}
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.body.dir = dir;
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICT[lang];
      let s = dict[key] ?? AR[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, String(v));
        }
      }
      return s;
    },
    [lang]
  );

  const td = useCallback(
    (raw: string | undefined | null) => translateValue(raw, lang),
    [lang]
  );

  const dir = lang === "ar" ? "rtl" : "ltr";

  return createElement(I18nCtx.Provider, { value: { lang, setLang, t, td, dir } }, children);
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    // Fallback (no provider) — Arabic identity
    return {
      lang: "ar",
      setLang: () => {},
      t: (k) => AR[k] ?? k,
      td: (r) => (r == null || r === "" ? "—" : r),
      dir: "rtl",
    };
  }
  return ctx;
}

export function netLabel(key: string, lang: Lang, short = false): string {
  const k = short ? `net.${key}_short` : `net.${key}`;
  return DICT[lang][k] ?? DICT.ar[k] ?? key;
}
