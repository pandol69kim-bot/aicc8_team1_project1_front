import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FoodCardRecommend from './FoodCardRecommend';
import { FaStar, FaSearch } from 'react-icons/fa';
import { TbMessageChatbot } from 'react-icons/tb';
import { IoMdRefresh } from 'react-icons/io';
import { LuArrowDownUp, LuCheck } from 'react-icons/lu';

const RecommendPage = () => {
  const navigate = useNavigate();
  const [recommendedFoods, setRecommendedFoods] = useState([]);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [finalSearchTerm, setFinalSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isFavoriteView, setIsFavoriteView] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [sortType, setSortType] = useState('latest');

  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);
  const recommendedFoodsRef = useRef(recommendedFoods);
  recommendedFoodsRef.current = recommendedFoods;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 즐겨찾기 로컬스토리지 연동
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('food-favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('food-favorites', JSON.stringify(favorites));
  }, [favorites]);

  /**
   * '(' 가 나오기 전까지의 순수 이름만 추출하는 함수
   * 예: "비빔밥(고추장)" -> "비빔밥", "치킨" -> "치킨"
   */
  const getBaseName = (name) => {
    if (!name) return '';
    // 괄호가 있으면 분리, 없으면 전체 이름 반환
    return name.split('(')[0].trim();
  };

  /**
   * 중복 여부 확인: 괄호 전(혹은 전체이름)의 앞 4글자가 같은 카드가 있는지 검사
   */
  const isDuplicateByName = (name, existingFoods) => {
    const baseName = getBaseName(name);
    if (!baseName) return false;

    // 비교 기준: 이름의 앞 4글자 (이름이 4글자 미만이면 전체 이름)
    const prefix = baseName.slice(0, 4);

    return existingFoods.some((f) => {
      const existingBase = getBaseName(f.name);
      return existingBase.slice(0, 4) === prefix;
    });
  };

  /**
   * 새로 추천된 음식 중 기존 리스트와 이름(괄호 제외)이 겹치는 것은 제외하고 병합
   */
  const mergeRecommendedFoods = (newFoods, existingFoods) => {
    const normalized = normalizeData(newFoods);
    const existing = existingFoods || [];
    const toAdd = [];

    normalized.forEach((food) => {
      // 1. 기존 리스트와 비교
      const isInExisting = isDuplicateByName(food.name, existing);
      // 2. 현재 새로 추가하려는 리스트 내부에서의 중복 비교 (앞 4글자 기준)
      const isInNewToAdd = isDuplicateByName(food.name, toAdd);

      if (!isInExisting && !isInNewToAdd) {
        toAdd.push(food);
      }
    });

    // 중복 제외된 새 음식들을 기존 리스트 앞에 추가
    return [...toAdd, ...existing];
  };

  /**
   * 데이터 정규화 함수
   */
  const normalizeData = (data) => {
    const rawList = Array.isArray(data) ? data : data.foods || [];
    return rawList.map((f) => ({
      id: f.id || Math.random(),
      name: f.name || f.title || '이름 없음',
      description: f.description || '',
      tags: f.tags || [],
      kcal: f.kcal || f.calories || 0,
      carbs: f.carbs || 0,
      protein: f.protein || 0,
      fat: f.fat || 0,
      sugar: f.sugar || 0,
    }));
  };

  // 초기 랜덤 데이터 로드
  const fetchRandomFoods = async () => {
    setIsDataLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/recommend/random');
      const data = await res.json();
      const normalized = normalizeData(data);

      // 초기 로드 데이터에서도 앞 4글자 중복 제거
      const uniqueInitial = [];
      normalized.forEach((f) => {
        if (!isDuplicateByName(f.name, uniqueInitial)) {
          uniqueInitial.push(f);
        }
      });
      setRecommendedFoods(uniqueInitial);
    } catch (err) {
      console.error('초기 로드 실패', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    fetchRandomFoods();
  }, []);

  // AI 챗봇 상태
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '안녕하세요! 당신의 현재 영양 상태를 분석하여 최적의 식단을 추천해 드립니다. 어떤 음식이 궁금하신가요?',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  // 상단 필터 태그 목록
  const filterTags = [
    '고단백',
    '다이어트',
    '채소',
    '고지방',
    '고당',
    '저탄수',
    '0kcal',
    '저당',
    '고칼로리',
    '과일',
    '저지방',
  ];

  // AI 챗봇 전송
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const token = localStorage.getItem('accessToken');
    const userMsg = { role: 'user', content: inputMessage };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/recommend/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          inputMessage: currentInput,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.chatContent || data.reply },
        ]);

        if (data.foods && data.foods.length > 0) {
          const current = recommendedFoodsRef.current;
          const merged = mergeRecommendedFoods(data.foods, current);
          setRecommendedFoods(merged);
          triggerLoading();
        }
      }
    } catch (error) {
      console.error('Chat API Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '서버와 통신 중 에러가 발생했습니다.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const triggerLoading = () => {
    setIsDataLoading(true);
    setTimeout(() => setIsDataLoading(false), 300);
  };

  const handleSearch = () => {
    triggerLoading();
    setFinalSearchTerm(searchTerm);
  };

  const toggleFavorite = (id) => {
    const isFav = favorites.includes(id);
    setFavorites((prev) =>
      isFav ? prev.filter((favId) => favId !== id) : [...prev, id],
    );
  };

  const handleFilter = (label) => {
    triggerLoading();
    setSelectedTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label],
    );
  };

  const resetFilters = () => {
    triggerLoading();
    setSearchTerm('');
    setFinalSearchTerm('');
    setSelectedTags([]);
    setIsFavoriteView(false);
  };

  const handleToggleCheck = (food) => {
    navigate('/home/dailyLog', { state: { food } });
  };

  const handleDelete = (id) => {
    setRecommendedFoods((prev) => prev.filter((f) => f.id !== id));
  };

  // 필터링 및 정렬 로직
  const displayFoods = recommendedFoods
    .filter((food) => {
      const matchesSearch = food.name
        .toLowerCase()
        .includes(finalSearchTerm.toLowerCase());
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) =>
          // food.tags 안에 "#고단백" 처럼 tag("고단백")를 포함한 요소가 있는지 확인
          food.tags?.some((foodTag) => foodTag.includes(tag)),
        );
      const matchesFavorite = isFavoriteView
        ? favorites.includes(food.id)
        : true;
      return matchesSearch && matchesTags && matchesFavorite;
    })
    .sort((a, b) => {
      // 실제 정렬 로직 추가
      if (sortType === 'name') {
        return a.name.localeCompare(b.name); // 이름순 (ㄱ-ㅎ)
      } else if (sortType === 'namereverse') {
        return b.name.localeCompare(a.name); // 이름역순 (ㅎ-ㄱ)
      } else {
        // 최신순 (latest):
        return 0;
      }
    });

  return (
    <div className="flex w-full p-4 gap-4 text-[#1E2923] bg-gray-50 h-[92vh] max-h-[1000px] overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF8203; border-radius: 10px; }
      `}</style>

      {/* 좌측: AI 챗봇 영역 */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-white shrink-0">
          <h2 className="font-bold flex items-center gap-2">
            <TbMessageChatbot size={24} color="#FF8243" />
            <span className="text-lg">AI 식단 분석가</span>
          </h2>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 p-4 overflow-y-auto bg-[#F9FBFA] space-y-4 custom-scrollbar"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`p-3 px-4 rounded-2xl shadow-sm max-w-[85%] text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#FF8243] text-white rounded-tr-none'
                    : 'bg-white text-[#1E2923] border border-gray-100 rounded-tl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="p-3 px-4 rounded-2xl shadow-sm text-sm text-gray-400 bg-white border border-gray-100 rounded-tl-none animate-pulse max-w-[85%]">
              AI가 최적의 식단을 분석 중입니다 ...
            </div>
          )}
        </div>
        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="음식 이름이나 영양 고민을 입력하세요 ..."
              className="flex-1 p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#FF8243] text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading}
              className="bg-[#FF8243] text-white px-5 rounded-xl text-sm font-medium disabled:bg-gray-300 hover:bg-[#e6753d]"
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* 우측: 리스트 영역 */}
      <div className="flex-2 flex flex-col min-w-0 h-full overflow-hidden relative pt-1">
        <div className="shrink-0 space-y-2 mb-3 px-2">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="식단 검색 ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full p-2.5 pl-4 bg-white rounded-xl shadow-sm border border-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#FF8243]"
              />
              <FaSearch
                className="absolute right-4 top-3.5 text-gray-400 cursor-pointer"
                onClick={handleSearch}
              />
            </div>
            <button
              onClick={() => {
                triggerLoading();
                setIsFavoriteView(!isFavoriteView);
              }}
              className="p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm"
            >
              <FaStar
                size={18}
                color={isFavoriteView ? '#FF8243' : '#D1D5DB'}
              />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetFilters}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:text-[#FF8243] transition-colors shrink-0"
            >
              <IoMdRefresh size={20} />
            </button>
            <div className="flex-1 flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
              {filterTags.map((label) => (
                <button
                  key={label}
                  onClick={() => handleFilter(label)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${
                    selectedTags.includes(label)
                      ? 'bg-[#FF8243] text-white border-[#FF8243]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  #{label}
                </button>
              ))}
            </div>

            <div className="relative shrink-0" ref={sortRef}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center justify-between gap-2 pl-4 pr-3 py-2.5 bg-white border border-gray-100 rounded-xl text-[14px] font-semibold text-gray-700 shadow-sm hover:border-[#FF8243] hover:shadow-md transition-all min-w-[190px]"
              >
                <div className="flex items-center gap-2">
                  <LuArrowDownUp size={17} className="text-[#FF8243] mr-1" />
                  <span className="text-[13px]">
                    {sortType === 'latest'
                      ? '최신순'
                      : sortType === 'name'
                        ? '이름순(ㄱ-ㅎ)'
                        : '이름순(ㅎ-ㄱ)'}
                  </span>
                </div>
              </button>

              {isSortOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                  {[
                    { label: '최신순', value: 'latest' },
                    { label: '이름순 (ㄱ-ㅎ)', value: 'name' },
                    { label: '이름순 (ㅎ-ㄱ)', value: 'namereverse' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortType(opt.value);
                        setIsSortOpen(false);
                        triggerLoading();
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50 ${
                        sortType === opt.value
                          ? 'text-[#FF8243] font-bold bg-orange-100/50'
                          : 'text-gray-600'
                      }`}
                    >
                      {opt.label}
                      {sortType === opt.value && <LuCheck size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 custom-scrollbar relative">
          {isDataLoading && (
            <div className="sticky top-0 inset-x-0 h-full flex items-center justify-center bg-gray-50/50 z-20">
              <div className="w-8 h-8 border-4 border-[#FF8243] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {displayFoods.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {displayFoods.map((food) => (
                <FoodCardRecommend
                  key={food.id}
                  food={food}
                  isFavorite={favorites.includes(food.id)}
                  onToggleFavorite={() => toggleFavorite(food.id)}
                  onDelete={() => handleDelete(food.id)}
                  onToggleCheck={() => handleToggleCheck(food)}
                />
              ))}
            </div>
          ) : (
            !isDataLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm font-medium">검색 결과가 없습니다.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default RecommendPage;
