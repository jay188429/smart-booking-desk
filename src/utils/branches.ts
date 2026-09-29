export const BRANCHES = [
  { id: 'kondae', name: '건대역지점', station: '건대입구역', latitude: 37.5404, longitude: 127.0692, virtual: true },
  { id: 'gangnam', name: '강남지점', station: '신논현역', latitude: 37.5045, longitude: 127.0257, virtual: true },
  { id: 'euljiro', name: '을지로지점', station: '을지로입구역', latitude: 37.5660, longitude: 126.9827, virtual: true },
] as const;

export type BranchId = (typeof BRANCHES)[number]['id'];

export function getBranch(branchId: string | null | undefined) {
  return BRANCHES.find(branch => branch.id === branchId) ?? BRANCHES[0];
}
