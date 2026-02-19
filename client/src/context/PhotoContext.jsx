import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/photos.js';

const PhotoContext = createContext();

const initialState = {
  photos: [],
  counts: { total: 0, love: 0, like: 0, meh: 0, tax_deduction: 0, unrated: 0 },
  filterTag: null,
  searchQuery: '',
  hideClaimed: true,
  selectedPhoto: null,
  loading: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PHOTOS':
      return { ...state, photos: action.photos, counts: action.counts, loading: false };
    case 'SET_FILTER_TAG':
      return { ...state, filterTag: action.tag };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SET_HIDE_CLAIMED':
      return { ...state, hideClaimed: action.value };
    case 'SET_SELECTED':
      return { ...state, selectedPhoto: action.photo };
    case 'SET_LOADING':
      return { ...state, loading: true };
    default:
      return state;
  }
}

export function PhotoProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const searchTimerRef = useRef(null);

  const loadPhotos = useCallback(async (filterTag, searchQuery, hideClaimed) => {
    dispatch({ type: 'SET_LOADING' });
    try {
      const params = {};
      if (filterTag) params.tag = filterTag;
      if (searchQuery) params.search = searchQuery;
      if (hideClaimed) params.hideClaimed = true;
      const data = await api.fetchPhotos(params);
      dispatch({ type: 'SET_PHOTOS', photos: data.photos, counts: data.counts });
    } catch (err) {
      console.error('Failed to load photos:', err);
    }
  }, []);

  // Reload when filter or hideClaimed changes (immediate)
  useEffect(() => {
    loadPhotos(state.filterTag, state.searchQuery, state.hideClaimed);
  }, [state.filterTag, state.hideClaimed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadPhotos(state.filterTag, state.searchQuery, state.hideClaimed);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [state.searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilterTag = useCallback((tag) => {
    dispatch({ type: 'SET_FILTER_TAG', tag });
  }, []);

  const setSearchQuery = useCallback((query) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  const setHideClaimed = useCallback((value) => {
    dispatch({ type: 'SET_HIDE_CLAIMED', value });
  }, []);

  const setSelectedPhoto = useCallback((photo) => {
    dispatch({ type: 'SET_SELECTED', photo });
  }, []);

  const tagPhoto = useCallback(async (id, tag) => {
    await api.tagPhoto(id, tag);
    await loadPhotos(state.filterTag, state.searchQuery, state.hideClaimed);
  }, [loadPhotos, state.filterTag, state.searchQuery, state.hideClaimed]);

  const reorderPhoto = useCallback(async (id, newPosition) => {
    await api.reorderPhoto(id, newPosition);
    await loadPhotos(state.filterTag, state.searchQuery, state.hideClaimed);
  }, [loadPhotos, state.filterTag, state.searchQuery, state.hideClaimed]);

  const scanPhotos = useCallback(async () => {
    await api.triggerScan();
    await loadPhotos(state.filterTag, state.searchQuery, state.hideClaimed);
  }, [loadPhotos, state.filterTag, state.searchQuery, state.hideClaimed]);

  const value = {
    ...state,
    setFilterTag,
    setSearchQuery,
    setHideClaimed,
    setSelectedPhoto,
    tagPhoto,
    reorderPhoto,
    scanPhotos,
    loadPhotos: () => loadPhotos(state.filterTag, state.searchQuery, state.hideClaimed),
  };

  return (
    <PhotoContext.Provider value={value}>
      {children}
    </PhotoContext.Provider>
  );
}

export function usePhotos() {
  const ctx = useContext(PhotoContext);
  if (!ctx) throw new Error('usePhotos must be used within PhotoProvider');
  return ctx;
}
