const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "en";

export const isKorean = locale.toLowerCase().startsWith("ko");

type Dict = Record<string, { ko: string; en: string }>;

const dict: Dict = {
  tab_home: { ko: "홈", en: "Home" },
  tab_search: { ko: "검색", en: "Search" },
  tab_rank: { ko: "인기", en: "Rank" },
  tab_shelf: { ko: "서재", en: "Shelf" },
  tab_my: { ko: "마이", en: "My" },

  home_headline: { ko: "오늘 한국이 읽고 있는 책을 발견하세요", en: "Discover what Korea is reading today" },
  home_subtitle: {
    ko: "공공도서관 네트워크의 실시간 인사이트. 트렌드를 탐색하고 대출 가능 여부를 확인하세요.",
    en: "Real-time public library network insights. Explore trends and check loan availability.",
  },
  home_type_title: { ko: "도서명", en: "Title" },
  home_type_author: { ko: "저자명", en: "Author" },
  home_ai_recommend: { ko: "AI 추천", en: "AI Recommend" },
  home_placeholder_ai: {
    ko: "키워드를 입력하면 AI가 관련도서를 추천해드립니다",
    en: "Enter keywords and AI will recommend related books",
  },
  home_placeholder_title: { ko: "도서명을 입력하세요...", en: "Enter a book title..." },
  home_placeholder_author: { ko: "저자명을 입력하세요...", en: "Enter an author name..." },
  home_btn_search: { ko: "검색", en: "Search" },
  home_login_required: { ko: "로그인이 필요합니다", en: "Login required" },
  home_login_ai_desc: { ko: "AI 추천을 사용하려면 로그인해주세요.", en: "Sign in to use AI recommendations." },
  common_cancel: { ko: "취소", en: "Cancel" },
  common_login: { ko: "로그인", en: "Log in" },
  home_monthly_pick: { ko: "이달의 추천", en: "Monthly Pick" },
  home_monthly_pick_error: { ko: "추천 정보를 불러오지 못했습니다.", en: "Failed to load recommendation." },
  home_new_arrivals: { ko: "신착 도서", en: "New Arrivals" },
  home_new_arrivals_error: { ko: "신착 도서를 불러오지 못했습니다.", en: "Failed to load new arrivals." },

  search_title: { ko: "검색", en: "Search" },
  search_placeholder_ai: {
    ko: "키워드를 입력하면 AI가 관련도서를 추천해드립니다",
    en: "Enter keywords and AI will recommend related books",
  },
  search_placeholder_title: { ko: "도서명을 입력하세요", en: "Enter a book title" },
  search_placeholder_author: { ko: "저자명을 입력하세요", en: "Enter an author name" },
  search_ai_mode_enabled: { ko: "AI 모드 활성화", en: "AI mode enabled" },
  search_ai_toggle: { ko: "AI 검색", en: "AI Search" },
  search_ai_banner: {
    ko: "취향, 분위기, 장르, 읽는 상황을 입력하면 AI가 추천해드려요.",
    en: "Enter a preference, mood, genre, or reading situation for AI recommendations.",
  },
  search_loading_ai: { ko: "AI 추천 결과를 생성 중입니다...", en: "Generating AI recommendations..." },
  search_loading_normal: { ko: "도서를 검색하는 중입니다...", en: "Searching books..." },
  search_empty_prompt_ai: {
    ko: "예: 겨울에 읽기 좋은 소설, 스타트업 리더십, 통계 입문 책",
    en: "Try: cozy winter novel, startup leadership, or books for learning statistics",
  },
  search_empty_prompt_normal: { ko: "검색어를 입력해 도서를 찾아보세요", en: "Enter a search term to find books" },
  search_no_results: { ko: "검색 결과가 없습니다.", en: "No results found." },
  search_ai_error: { ko: "AI 검색에 실패했습니다. 다른 문구로 다시 시도해보세요.", en: "AI search failed. Please try another prompt or retry." },
};

export function t(key: keyof typeof dict): string {
  return isKorean ? dict[key].ko : dict[key].en;
}
