import React, { useRef, useMemo, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { FaPlus, FaMinus, FaPlusMinus } from 'react-icons/fa6';
import { PiChefHat } from 'react-icons/pi';
import { Loader2 } from 'lucide-react';
import { NutrientRadarChart, WeeklyLineChart } from './ReportCharts';
import ReportCards from './ReportCards';
import { useProfile } from '../../contexts/ProfileContext'; // 닉네임 사용을 위해 추가
import { getDailySummaries, getNutritionGoals } from '../../api/nutrition.js';
import {
  startOfWeek,
  endOfWeek,
  format,
  eachDayOfInterval,
  subWeeks,
} from 'date-fns';

const ReportPage = () => {
  const reportRef = useRef(null);
  const { profile } = useProfile(); // 프로필 정보(닉네임) 가져오기
  const [dailyData, setDailyData] = useState([]);
  const [lastWeekData, setLastWeekData] = useState([]); // 변화량 계산용
  const [goals, setGoals] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [foodList, setFoodList] = useState([]);

  // 현재 주 및 지난 주 날짜 계산
  const today = new Date();
  const startDateStr = format(
    startOfWeek(today, { weekStartsOn: 1 }),
    'yyyy-MM-dd',
  );
  const endDateStr = format(
    endOfWeek(today, { weekStartsOn: 1 }),
    'yyyy-MM-dd',
  );

  const lastWeekStart = format(
    subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1),
    'yyyy-MM-dd',
  );
  const lastWeekEnd = format(
    subWeeks(endOfWeek(today, { weekStartsOn: 1 }), 1),
    'yyyy-MM-dd',
  );

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        // 이번 주 데이터, 지난 주 데이터, 영양 목표를 한 번에 호출
        const [summaryRes, lastWeekRes, goalRes] = await Promise.all([
          getDailySummaries(startDateStr, endDateStr),
          getDailySummaries(lastWeekStart, lastWeekEnd),
          getNutritionGoals(),
        ]);

        // 이번 주 7일 데이터 포맷팅
        const allDays = eachDayOfInterval({
          start: new Date(startDateStr),
          end: new Date(endDateStr),
        }).map((d) => format(d, 'yyyy-MM-dd'));

        const formattedData = allDays.map((date) => {
          const found = summaryRes.data.find((item) => item.date === date);
          return (
            found || {
              date,
              kcal: 0,
              carbohydrate: 0,
              protein: 0,
              fat: 0,
              sugars: 0,
              score: 0,
            }
          );
        });

        setDailyData(formattedData);
        setLastWeekData(lastWeekRes.data || []);
        setGoals(goalRes.data);
      } catch (error) {
        console.error('Data fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [startDateStr, endDateStr, lastWeekStart, lastWeekEnd]);

  // 이번 주 평균 점수
  const averageScore = useMemo(() => {
    if (dailyData.length === 0) return 0;
    return Math.round(
      dailyData.reduce((acc, cur) => acc + (cur.score || 0), 0) / 7,
    );
  }, [dailyData]);

  // 지난 주 대비 변화량 계산 (diffLastWeek)
  const diffLastWeek = useMemo(() => {
    if (lastWeekData.length === 0) return 0;
    const lastWeekAvg = Math.round(
      lastWeekData.reduce((acc, cur) => acc + (cur.score || 0), 0) / 7,
    );
    return averageScore - lastWeekAvg;
  }, [averageScore, lastWeekData]);

  // 최신 기록 데이터 (오늘 또는 기록된 마지막 날)
  const latestData = useMemo(() => {
    return (
      dailyData.filter((d) => d.kcal > 0).pop() || {
        kcal: 0,
        carbohydrate: 0,
        protein: 0,
        fat: 0,
        sugars: 0,
      }
    );
  }, [dailyData]);

  // 차트 및 영양소 데이터 가공
  const radarData = [
    { subject: '칼로리', value: latestData.kcal > 0 ? 85 : 0 },
    { subject: '탄수화물', value: latestData.carbohydrate > 0 ? 70 : 0 },
    { subject: '단백질', value: latestData.protein > 0 ? 90 : 0 },
    { subject: '지방', value: latestData.fat > 0 ? 60 : 0 },
    { subject: '당류', value: latestData.sugars > 0 ? 40 : 0 },
  ];

  const nutritionData = [
    {
      id: 1,
      name: '탄수화물',
      inputAmount: latestData.carbohydrate,
      adviseAmount: goals?.targetCarbs || 0,
    },
    {
      id: 2,
      name: '단백질',
      inputAmount: latestData.protein,
      adviseAmount: goals?.targetProtein || 0,
    },
    {
      id: 3,
      name: '지방',
      inputAmount: latestData.fat,
      adviseAmount: goals?.targetFat || 0,
    },
    {
      id: 4,
      name: '당류',
      inputAmount: latestData.sugars,
      adviseAmount: goals?.targetSugars || 0,
    },
  ];

  const lineData = dailyData.map((item) => ({
    day: item.date.slice(5, 10).replace('-', '/'),
    kcal: item.kcal,
    carbohydrate: item.carbohydrate,
    protein: item.protein,
    fat: item.fat,
    sugars: item.sugars,
  }));

  const handleDownloadPdf = async () => {
    if (reportRef.current === null) return;
    try {
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: '#F2F9F5',
        pixelRatio: 3,
      });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      const marginTop = (pageHeight - imgHeight) / 2;
      pdf.addImage(dataUrl, 'PNG', 0, marginTop, imgWidth, imgHeight);
      pdf.save(`HoneyMat_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF 생성 오류:', err);
      alert('PDF 생성 중 오류가 발생했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-[#FF8243]">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-2 min-h-screen">
      <div
        ref={reportRef}
        className="bg-[#F2F9F5] text-[#1E2923] w-full mx-auto rounded-2xl border border-gray-100 p-5"
      >
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-6">
            {/* 상단 요약 카드 */}
            <div className="bg-white flex justify-between items-center p-5 rounded-xl shadow-sm border-l-8 border-[#FF8243]">
              <h2 className="text-gray-700 text-[19px] mr-4">
                <span className="text-gray-700 font-semibold text-[22px] pr-1">
                  {profile?.nickname || '??'}
                </span>
                님의 주간 영양 점수는{' '}
                <span className="text-[#FF8243] font-bold text-[23px] pr-1">
                  {averageScore}점
                </span>
                입니다.
              </h2>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center whitespace-nowrap gap-2">
                  <span className="text-gray-600 text-[15px] mt-0.5">
                    지난 주 대비
                  </span>
                  <div
                    className={`flex items-center gap-0.5 font-bold text-[19px] ${
                      diffLastWeek > 0
                        ? 'text-emerald-600'
                        : diffLastWeek < 0
                          ? 'text-sky-600'
                          : 'text-gray-600'
                    }`}
                  >
                    {diffLastWeek > 0 ? (
                      <FaPlus size={13} className="mt-0.5" />
                    ) : diffLastWeek < 0 ? (
                      <FaMinus size={13} className="mt-0.5" />
                    ) : (
                      <FaPlusMinus size={13} className="mt-0.5" />
                    )}
                    {Math.abs(diffLastWeek)}
                  </div>
                  <span className="text-gray-500 text-[17px] -mt-0.5 -ml-1">
                    점
                  </span>
                </div>
              </div>
            </div>

            {/* 영양 밸런스, 과잉/결핍 섹션 */}
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold mb-6 text-gray-800 border-b pb-2">
                  영양 밸런스
                </h3>
                <NutrientRadarChart data={radarData} />
              </div>

              <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <h3 className="font-bold mb-4 text-gray-800 border-b pb-3">
                  과잉/결핍 영양소
                </h3>
                <div className="flex-1 ">
                  <ReportCards nutritionData={nutritionData} />
                </div>
              </div>
            </div>

            {/* 7일간 변화 추이 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold mb-6 text-gray-800 border-b pb-2">
                7일간 변화 추이
              </h3>
              <WeeklyLineChart data={lineData} />
            </div>
          </div>

          {/* AI 리뷰 사이드바 + 영양 결핍 체크 */}
          <div className="col-span-1 flex flex-col gap-5">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-4 flex items-center text-gray-800">
                <span className="mr-2">
                  <PiChefHat size={22} color="#FF8243" />
                </span>
                AI 영양사 리뷰
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <div className="bg-white p-4 rounded-xl border-2 border-[#FF8243] shadow-sm">
                  <p className="font-medium text-sm text-[#1E2923]">
                    "단백질 섭취가 매우 우수합니다. 다만 비타민 부족이 관찰되니
                    과일 섭취를 늘려보세요."
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-[#FF8243]">
                    개선 포인트
                  </h4>
                  <ul className="list-disc ml-4 space-y-1 text-xs text-gray-600">
                    <li>정제 탄수화물(흰 쌀밥) 대신 잡곡밥 선택</li>
                    <li>하루 물 2L 섭취 루틴 유지하기</li>
                    <li>취침 3시간 전 금식 실천</li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="font-bold text-sm text-[#FF8243] mb-3">
                    추천 식단 구성
                  </h4>
                  <div className="flex flex-col gap-3">
                    {foodList.map((item) => (
                      <FoodCardRecommend key={item.id} food={item} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF 저장 버튼 */}
      <div className="items-center justify-center mx-auto flex mb-4 mt-4">
        <button
          onClick={handleDownloadPdf}
          className="bg-[#FF8243] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#ff8243c9] transition-all shadow-lg active:scale-95"
        >
          PDF로 저장
        </button>
      </div>
    </div>
  );
};

// ─── 영양 결핍 체크 카드 ────────────────────────────────────────────────────
function DeficiencyCheckCard({ userId }) {
  const [dateStr, setDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [checkError, setCheckError] = useState(null);

  const handleCheck = async () => {
    if (!userId) {
      setCheckError('로그인이 필요합니다.');
      return;
    }
    setChecking(true);
    setCheckError(null);
    setResult(null);
    try {
      const res = await checkDeficiency(dateStr, userId);
      setResult(res?.data ?? null);
    } catch (err) {
      setCheckError(
        err?.response?.data?.message ??
          err?.message ??
          '결핍 체크에 실패했습니다.',
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-lg mb-4 flex items-center text-gray-800">
        <span className="mr-2">
          <Stethoscope size={20} color="#FF8243" />
        </span>
        영양 결핍 체크
      </h3>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800"
        />
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking || !userId}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 bg-[#FF8243] hover:bg-[#e57339]"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Stethoscope size={16} />
          )}
          {checking ? '검사 중...' : '결핍 체크'}
        </button>
      </div>
      {checkError && <p className="text-sm text-red-500 mb-2">{checkError}</p>}
      {result && (
        <div className="space-y-2">
          {result.alerts?.length ? (
            <ul className="space-y-1.5">
              {result.alerts.map((a, i) => (
                <li
                  key={i}
                  className="text-sm px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-gray-800"
                >
                  <span className="font-semibold">
                    {a.type === 'CALORIES'
                      ? '칼로리'
                      : a.type === 'CARBOHYDRATE'
                        ? '탄수화물'
                        : a.type === 'PROTEIN'
                          ? '단백질'
                          : a.type === 'FAT'
                            ? '지방'
                            : a.type}
                  </span>
                  : 목표 {a.target} 중 {a.current} 섭취 (부족)
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">
              선택한 날짜에 영양 결핍이 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportPage;
