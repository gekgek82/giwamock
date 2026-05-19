# POINT SYSTEM v5 Contract 변경 요구사항 분석

v5 업데이트로 인해 발생한 정책 변경이 기존 온체인 `TerPoint` 및 `PointExchanger` 컨트랙트에 미치는 영향을 검토한 내용입니다.

## 1. 개요
v5 업데이트의 핵심인 **"레거시 뱃지 및 파트너십 뱃지에 따른 TGE 부스트 곱산"** 적용에 따라 컨트랙트 레벨에서 어떤 조치가 필요한지를 정리합니다. 

현재 구조에서는 유저 활동 포인트가 DB(Off-chain)에 기록된 후, 백엔드 Minter가 `batchMint()`를 통해 `TerPoint` 토큰을 일괄 발급합니다. 그리고 TGE 시점에 유저는 `PointExchanger` 컨트랙트를 통해 보유한 `TerPoint` 토큰을 `TER` / `veTER` 로 교환(Burn & Mint)하게 됩니다.

## 2. 변경 요구사항 검토

### 2.1. TerPoint (tPOINT) 발급 컨트랙트
- **현재 구조**: 백엔드가 `batchMint(recipients, amounts, epochId, reasonCode)`를 호출. `reasonCode` 0, 1은 캡 공유, 2, 3은 무제한 발급.
- **v5 변경점**: 추천인/피추천인 모두에게 보상이 지급되며 수량이 크게 늘어납니다. 그러나 이는 모두 오프체인 백엔드에서 계산된 후 `amount`로 전달되므로 **컨트랙트 자체를 수정할 필요는 없습니다.** `reasonCode = 2 (Referral)`로 그대로 발급하면 됩니다.

### 2.2. PointExchanger 컨트랙트 및 TGE 부스트
- **현재 구조**: 유저가 보유한 `tPOINT` 잔액을 기준으로 `PointExchanger.exchange()`를 호출하여 `TER`로 교환. (비율은 `exchangeRate` 기준)
- **v5 변경점 (이슈 발생)**:
  - v5에서는 `Final TGE Point = [Base Points * (1 + Σ Badge Boosts)] + Referral Points` 공식이 적용되어야 합니다.
  - 즉, 유저 지갑에 들어있는 **전체 `tPOINT` 잔액에 단순하게 일괄 교환비(`exchangeRate`)를 곱해서는 안 됩니다.** `Base Points`와 `Referral Points`가 서로 다른 부스트 배율을 적용받아야 하기 때문입니다.
  - 하지만 온체인 ERC20 토큰(tPOINT)은 그 자체로 "이 토큰이 Base인지 Referral인지" 구분하는 속성(Tag)이 없습니다. (단일 Balance로 합쳐짐)

### 2.3. 해결 방안 (선택 사항)

#### 방안 A: 백엔드에서 부스트가 적용된 최종 수량을 미리 민팅하기 (추천 - Contract 수정 불필요)
- TGE 이전(또는 각 시즌 종료 시점)에 백엔드에서 유저별 뱃지를 조회하여 부스트 분량만큼의 `tPOINT`를 **별도의 이벤트(reasonCode=3)로 추가 발급(batchMint)** 해줍니다.
- 이렇게 하면 유저의 지갑 잔액 자체가 이미 부스트가 적용된 최종 포인트량이 되므로, 기존 `PointExchanger` 컨트랙트의 `exchange()` 로직(잔액 * 교환비)을 그대로 사용할 수 있습니다.

#### 방안 B: PointExchanger 컨트랙트 수정 (복잡함)
- 교환 시 단순히 잔액을 기준으로 하지 않고, 백엔드에서 서명한 **Merkle Proof**나 **Signature**를 포함시켜 `exchange(amount, optionId, signature)` 형태로 호출하도록 `PointExchanger` 컨트랙트를 재작성해야 합니다.
- 유저가 자신의 부스트 정보가 포함된 최종 TER 수령량을 백엔드로부터 받아오고, 이를 컨트랙트가 검증한 후 교환해주는 방식입니다.

## 3. 결론

컨트랙트 수정을 최소화하고 시스템 안정성을 유지하기 위해 **방안 A(백엔드에서 부스트 분량 추가 민팅)** 방식을 채택하는 것이 가장 이상적입니다.

따라서, **v5 업데이트로 인한 스마트 컨트랙트(`TerPoint.sol`, `PointExchanger.sol`) 코드의 직접적인 수정은 필요하지 않습니다.**
대신, 백엔드의 정산 로직(또는 TGE 직전 특별 스크립트)에 뱃지 부스트를 계산하여 추가 `tPOINT`를 민팅하는 절차만 추가하면 됩니다.