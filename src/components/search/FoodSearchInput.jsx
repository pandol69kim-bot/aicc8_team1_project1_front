import { useState, useEffect, useRef } from 'react';
import { TextField, Paper, Box, Typography, CircularProgress } from '@mui/material';

/**
 * 음식 검색 자동완성 컴포넌트
 * @param {Object} props
 * @param {string} props.value - 현재 음식 이름 값
 * @param {function} props.onChange - (name, calories) => void - 음식 선택 또는 직접 입력 시 호출
 * @param {Object} props.sx - TextField에 적용할 스타일
 */
export default function FoodSearchInput({ value, onChange, sx }) {
    const [inputValue, setInputValue] = useState(value || '');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef(null);
    const debounceTimer = useRef(null);

    // 외부에서 value가 변경되면 inputValue 동기화
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // 컴포넌트 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 음식 검색 API 호출
    const searchFoods = async (query) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(
                `http://localhost:8000/api/foods/search?name=${encodeURIComponent(query)}`
            );
            if (response.ok) {
                const result = await response.json();
                // API 응답: { success, count, data: [...] }
                const foods = result.data || [];
                setSearchResults(foods);
                setShowDropdown(foods.length > 0);
                setHighlightedIndex(-1);
            } else {
                setSearchResults([]);
                setShowDropdown(false);
            }
        } catch (error) {
            console.error('음식 검색 실패:', error);
            setSearchResults([]);
            setShowDropdown(false);
        } finally {
            setIsLoading(false);
        }
    };

    // 입력 변경 핸들러 (디바운스 적용)
    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange(newValue, '', null); // 직접 입력 시 칼로리와 영양소는 비움

        // 디바운스: 300ms 후에 검색 실행
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            searchFoods(newValue);
        }, 300);
    };

    // 검색 결과 선택 핸들러
    const handleSelect = (food) => {
        setInputValue(food.food_name);
        // 영양소 정보, food_code, serving_size, calories 함께 전달
        onChange(food.food_name, Math.round(Number(food.calories)) || 0, {
            carbs: Number(food.carbohydrate) || 0,
            protein: Number(food.protein) || 0,
            fat: Number(food.fat) || 0,
            sugar: Number(food.sugars) || 0,
            foodCode: food.food_code,
            servingSize: Math.round(Number(food.serving_size)) || 0,
        });
        setShowDropdown(false);
        setSearchResults([]);
    };

    // 키보드 네비게이션
    const handleKeyDown = (e) => {
        if (!showDropdown || searchResults.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev < searchResults.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
                    handleSelect(searchResults[highlightedIndex]);
                }
                break;
            case 'Escape':
                setShowDropdown(false);
                break;
            default:
                break;
        }
    };

    return (
        <Box ref={containerRef} sx={{ position: 'relative', flexGrow: 1 }}>
            <TextField
                size="small"
                placeholder="음식 이름"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => {
                    if (searchResults.length > 0) setShowDropdown(true);
                }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                InputProps={{
                    endAdornment: isLoading ? (
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                    ) : null,
                }}
                sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5,
                        bgcolor: '#fff',
                        fontSize: '0.875rem',
                    },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e8ecf0' },
                    ...sx,
                }}
            />

            {/* 검색 결과 드롭다운 */}
            {showDropdown && searchResults.length > 0 && (
                <Paper
                    elevation={4}
                    sx={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        mt: 0.5,
                        maxHeight: 200,
                        overflowY: 'auto',
                        borderRadius: 2,
                        border: '1px solid #e8ecf0',
                    }}
                >
                    {searchResults.map((food, index) => (
                        <Box
                            key={index}
                            onClick={() => handleSelect(food)}
                            sx={{
                                px: 2,
                                py: 1,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                bgcolor:
                                    index === highlightedIndex
                                        ? '#fff3ed'
                                        : 'transparent',
                                '&:hover': {
                                    bgcolor: '#fff3ed',
                                },
                                borderBottom:
                                    index < searchResults.length - 1
                                        ? '1px solid #f1f5f9'
                                        : 'none',
                            }}
                        >
                            <Typography
                                variant="body2"
                                fontWeight={500}
                                sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1,
                                }}
                            >
                                {food.food_name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                                {food.serving_size > 0 && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: '#66BB6A',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {Math.round(food.serving_size)}g
                                    </Typography>
                                )}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: '#FF8243',
                                        fontWeight: 700,
                                    }}
                                >
                                    {Math.round(Number(food.calories)) || 0} kcal
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Paper>
            )}
        </Box>
    );
}
