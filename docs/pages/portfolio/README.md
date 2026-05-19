# Portfolio

## Overview

사용자의 포트폴리오 개요, 포지션, 리워드, 트랜잭션 히스토리를 표시하는 페이지.

## Route

`/portfolio`

## Components

- `Header`, `Footer`
- `OverviewSection` - 포트폴리오 요약 통계
- `PositionRewardSection` - 유동성 포지션 및 획득 리워드
- `TransactionHistory` - 과거 트랜잭션 목록

## 주요 기능

- **Overview**: 포트폴리오 전체 요약 (상단)
- **Positions & Rewards**: 유동성 포지션 및 리워드 정보 (중간)
- **Transaction History**: 전체 트랜잭션 기록 (하단)

## Notes

- Client component (`"use client"`)
- `useTranslations()`으로 i18n 지원
- 세 섹션이 수직으로 나열되는 단순한 레이아웃
