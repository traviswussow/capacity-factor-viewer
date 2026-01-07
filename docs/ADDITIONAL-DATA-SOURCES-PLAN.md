# Plan: Additional Data Sources for Retirement Tracking

## Current State

We currently have three data sources:
1. **EIA-860** - Official retirement dates from annual generator filings
2. **GEM Wiki** - Global Energy Monitor research on coal plant retirements
3. **Manual PDF Data** - Delay information from the "Coal Plant Closure Delays" PDF

## Gap Analysis

From comparing our dataset with the PDF:
- **33 plants missing** (31,654 MW total capacity)
- Key gaps in **Duke Energy NC plants** (6 plants, 5,309 MW)
- **Georgia Power plants** (Bowen, Scherer) partially captured
- Western state plants (PacifiCorp, Rocky Mountain Power) incomplete

## Recommended Additional Data Sources

### Priority 1: Utility IRP Documents (High Impact, Medium Effort)

**What**: Integrated Resource Plans filed by utilities with state regulators
**Value**: Contains planned retirement dates 5-15 years out, often before EIA-860 reflects changes
**Coverage**: Most major utilities publish annually

**Key Utilities to Track**:
| Utility | States | URL Pattern |
|---------|--------|-------------|
| Duke Energy | NC, SC, IN | duke-energy.com/our-company/about-us/irp |
| Dominion Energy | VA, NC, SC | dominionenergy.com/irp |
| AEP | OH, WV, IN, KY | aep.com/utilities/rates-regulatory |
| Xcel Energy | MN, CO, TX | xcelenergy.com/company/rates-regulatory |
| PacifiCorp/Rocky Mountain | UT, WY, OR, WA | pacificorp.com/energy/integrated-resource-plan |
| TVA | TN, KY, AL, MS | tva.com/energy/our-power-system/integrated-resource-plan |
| Southern Company | GA, AL, MS | southerncompany.com/irp |
| Entergy | LA, AR, TX, MS | entergy.com/investors/irp |

**Implementation**:
1. Create IRP scraper module
2. Parse PDF documents for retirement tables
3. Map utility plant names to EIA plant IDs
4. Store in `utility_irp_data` Supabase table

**Estimated Effort**: 2-3 weeks for initial implementation, ongoing maintenance

---

### Priority 2: State Utility Commission Dockets (High Impact, High Effort)

**What**: Official regulatory filings tracking plant retirement approvals
**Value**: Authoritative source for approved retirement dates and delays
**Coverage**: All regulated utilities (excludes merchant plants)

**Key Commission Sources**:
- NCUC (NC) - https://starw1.ncuc.gov/NCUC/
- PUCO (OH) - https://dis.puc.state.oh.us/
- KPSC (KY) - https://psc.ky.gov/
- IPUC (IN) - https://iurc.portal.in.gov/
- PUCT (TX) - https://www.puc.texas.gov/

**Implementation Approach**:
- Use docket search APIs where available
- Monitor for retirement-related case types
- Extract approval dates and conditions

**Estimated Effort**: 3-4 weeks per state, prioritize states with most coal

---

### Priority 3: DOE Section 202(c) Orders (High Impact, Low Effort)

**What**: Emergency orders requiring plants to continue operating
**Value**: Identifies plants with regulatory delays
**Coverage**: ~5-10 plants at any time

**Source**: DOE Office of Electricity (OE)
**URL**: https://www.energy.gov/oe/section-202c-emergency-orders

**Implementation**:
1. Scrape DOE OE page for current orders
2. Track order duration and renewal status
3. Flag affected plants in our dataset

**Estimated Effort**: 1 week

---

### Priority 4: EPA Power Sector Compliance (Medium Impact, Low Effort)

**What**: Plant compliance status with environmental regulations
**Value**: Identifies plants facing compliance deadlines that may drive retirements
**Coverage**: All coal and gas plants

**Sources**:
- CAMD Power Plant Data (air emissions)
- CCR Rule compliance deadlines
- ELG Rule compliance deadlines
- Good Neighbor Plan requirements

**Implementation**:
- Cross-reference EPA compliance data with retirement dates
- Flag plants approaching compliance deadlines

**Estimated Effort**: 2 weeks

---

### Priority 5: Bloomberg NEF / S&P Global (Low Feasibility)

**What**: Commercial energy databases with detailed plant tracking
**Value**: Most comprehensive and timely data
**Coverage**: Global

**Challenge**: Requires expensive subscriptions ($50k+/year)

**Alternative**: Monitor their public reports and press releases for key data points

---

## Data Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Retirement API                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │  EIA    │  │   GEM   │  │  Manual │  │   Utility   │ │
│  │  860    │  │  Wiki   │  │   PDF   │  │    IRPs     │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘ │
│       │            │            │               │        │
│       └────────────┴────────────┴───────────────┘        │
│                          │                               │
│                     ┌────▼────┐                          │
│                     │  Data   │                          │
│                     │ Merger  │                          │
│                     └────┬────┘                          │
│                          │                               │
│                     ┌────▼────┐                          │
│                     │ Dedup   │                          │
│                     │ & Match │                          │
│                     └────┬────┘                          │
│                          │                               │
│                     ┌────▼────┐                          │
│                     │   API   │                          │
│                     │Response │                          │
│                     └─────────┘                          │
└─────────────────────────────────────────────────────────┘
```

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)
- [ ] Implement DOE 202(c) order scraper
- [ ] Expand manual delay data with additional news sources
- [ ] Add EPA compliance data cross-reference

### Phase 2: Utility IRPs (Week 3-6)
- [ ] Build IRP document parser framework
- [ ] Implement Duke Energy IRP scraper
- [ ] Implement PacifiCorp IRP scraper
- [ ] Implement TVA IRP scraper
- [ ] Add `utility_irp_data` table to Supabase

### Phase 3: State Commissions (Week 7-10)
- [ ] Research API availability for target states
- [ ] Implement NCUC docket scraper (Duke Energy)
- [ ] Implement KPSC docket scraper (LG&E/KU)
- [ ] Create docket monitoring alert system

### Phase 4: Automation & Maintenance (Ongoing)
- [ ] Set up scheduled scraper runs (weekly for IRPs, monthly for GEM)
- [ ] Create data quality dashboard
- [ ] Implement change detection alerts
- [ ] Document data lineage and update frequency

## Success Metrics

1. **Coverage**: % of plants with retirement date from 2+ sources
2. **Timeliness**: Average days between announcement and database update
3. **Accuracy**: % of predictions matching actual retirements
4. **Completeness**: % of MW capacity with delay tracking data

## Next Steps

1. **Immediate**: Expand GEM scraper to download new plant pages (run `download-pages.ts`)
2. **This Week**: Implement DOE 202(c) order tracking
3. **Next Week**: Begin Duke Energy IRP parsing
