import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/photos.js';

const PhotoContext = createContext();

const initialState = {
  photos: [],
  counts: { total: 0, love: 0, like: 0, meh: 0, tax_deduction: 0, unrated: 0 },
  filterTag: 'all',
  searchQuery: '',
  hideClaimed: true,
  selectedPhoto: null,
  loading: false,
  viewMode: 'rank',
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
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SET_LOADING':
      return { ...state, loading: true };
    default:
      return state;
  }
}

export function PhotoProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const loadPhotos = useCallback(async () => {
    dispatch({ type: 'SET_LOADING' });
    const { filterTag, searchQuery, hideClaimed, viewMode } = stateRef.current;
    try {
      const params = {};
      if (viewMode === 'showId') {
        params.sort = 'show_id';
        if (searchQuery) params.search = searchQuery;
        if (hideClaimed) params.hideClaimed = true;
      } else {
        if (filterTag !== 'all') params.tag = filterTag;
        if (searchQuery) params.search = searchQuery;
        if (hideClaimed) params.hideClaimed = true;
      }
      const data = await api.fetchPhotos(params);
      dispatch({ type: 'SET_PHOTOS', photos: data.photos, counts: data.counts });
    } catch (err) {
      console.error('Failed to load photos:', err);
    }
  }, []);

  // Reload when filter, hideClaimed, or viewMode changes (immediate)
  useEffect(() => {
    loadPhotos();
  }, [state.filterTag, state.hideClaimed, state.viewMode, loadPhotos]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => loadPhotos(), 300);
    return () => clearTimeout(timer);
  }, [state.searchQuery, loadPhotos]);

  const setFilterTag = useCallback((tag) => {
    dispatch({ type: 'SET_FILTER_TAG', tag });
  }, []);

  const setSearchQuery = useCallback((query) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  const setHideClaimed = useCallback((value) => {
    dispatch({ type: 'SET_HIDE_CLAIMED', value });
  }, []);

  const setViewMode = useCallback((mode) => {
    dispatch({ type: 'SET_VIEW_MODE', mode });
  }, []);

  const setSelectedPhoto = useCallback((photo) => {
    dispatch({ type: 'SET_SELECTED', photo });
  }, []);

  const tagPhoto = useCallback(async (id, tag) => {
    await api.tagPhoto(id, tag);
    await loadPhotos();
  }, [loadPhotos]);

  const reorderPhoto = useCallback(async (id, newPosition) => {
    await api.reorderPhoto(id, newPosition);
    await loadPhotos();
  }, [loadPhotos]);

  const scanPhotos = useCallback(async () => {
    await api.triggerScan();
    await loadPhotos();
  }, [loadPhotos]);

  const value = {
    ...state,
    setFilterTag,
    setSearchQuery,
    setHideClaimed,
    setViewMode,
    setSelectedPhoto,
    tagPhoto,
    reorderPhoto,
    scanPhotos,
    loadPhotos,
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
