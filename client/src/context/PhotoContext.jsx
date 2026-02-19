import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/photos.js';

const PhotoContext = createContext();

const initialState = {
  photos: [],
  counts: { total: 0, love: 0, like: 0, meh: 0, tax_deduction: 0, unrated: 0 },
  filterTag: null,
  searchQuery: '',
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

  const loadPhotos = useCallback(async (filterTag, searchQuery) => {
    dispatch({ type: 'SET_LOADING' });
    try {
      const params = {};
      if (filterTag) params.tag = filterTag;
      if (searchQuery) params.search = searchQuery;
      const data = await api.fetchPhotos(params);
      dispatch({ type: 'SET_PHOTOS', photos: data.photos, counts: data.counts });
    } catch (err) {
      console.error('Failed to load photos:', err);
    }
  }, []);

  // Reload when filter changes (immediate)
  useEffect(() => {
    loadPhotos(state.filterTag, state.searchQuery);
  }, [state.filterTag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadPhotos(state.filterTag, state.searchQuery);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [state.searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilterTag = useCallback((tag) => {
    dispatch({ type: 'SET_FILTER_TAG', tag });
  }, []);

  const setSearchQuery = useCallback((query) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  const setSelectedPhoto = useCallback((photo) => {
    dispatch({ type: 'SET_SELECTED', photo });
  }, []);

  const tagPhoto = useCallback(async (id, tag) => {
    await api.tagPhoto(id, tag);
    await loadPhotos(state.filterTag, state.searchQuery);
  }, [loadPhotos, state.filterTag, state.searchQuery]);

  const reorderPhoto = useCallback(async (id, newPosition) => {
    await api.reorderPhoto(id, newPosition);
    await loadPhotos(state.filterTag, state.searchQuery);
  }, [loadPhotos, state.filterTag, state.searchQuery]);

  const scanPhotos = useCallback(async () => {
    await api.triggerScan();
    await loadPhotos(state.filterTag, state.searchQuery);
  }, [loadPhotos, state.filterTag, state.searchQuery]);

  const value = {
    ...state,
    setFilterTag,
    setSearchQuery,
    setSelectedPhoto,
    tagPhoto,
    reorderPhoto,
    scanPhotos,
    loadPhotos: () => loadPhotos(state.filterTag, state.searchQuery),
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
