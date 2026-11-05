// A prospect's local time from the state in their location. No I/O — unit tested.

const TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago", CA: "America/Los_Angeles",
  CO: "America/Denver", CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Boise", IL: "America/Chicago", IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago", KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/Detroit", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago", NV: "America/Los_Angeles", NH: "America/New_York",
  NJ: "America/New_York", NM: "America/Denver", NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago",
  OH: "America/New_York", OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", UT: "America/Denver",
  VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
};
const NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

export function timeZoneFor(location: string): string | null {
  const l = (location ?? "").trim();
  if (!l) return null;
  const code = l.match(/(?:,|\s)\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*(?:,\s*(?:USA|US|United States))?\s*$/);
  if (code && TZ[code[1]]) return TZ[code[1]];
  const low = l.toLowerCase();
  const name = Object.keys(NAMES).sort((a, b) => b.length - a.length).find(n => new RegExp(`\\b${n}\\b`).test(low));
  return name ? TZ[NAMES[name]] : null;
}

const AREA: Record<string, string> = (() => {
  const z: Record<string, string> = { E: "America/New_York", C: "America/Chicago", M: "America/Denver", A: "America/Phoenix", P: "America/Los_Angeles", K: "America/Anchorage", H: "Pacific/Honolulu" };
  const codes: Record<string, string> = {
    E: "201 202 203 207 212 215 216 220 223 227 229 231 234 239 240 248 252 260 267 272 276 301 302 304 305 313 315 317 321 324 326 330 332 336 339 347 351 352 363 380 386 401 404 407 410 412 413 419 423 434 440 443 445 448 463 470 472 475 478 484 502 508 513 516 517 518 540 551 561 567 570 571 574 582 585 586 603 606 607 609 610 614 616 617 631 640 645 646 656 667 678 679 680 681 686 689 703 704 706 716 717 718 724 727 728 732 734 740 743 754 757 762 765 770 771 772 774 781 786 802 803 804 810 812 813 814 821 826 828 835 838 839 843 845 848 854 856 857 859 860 862 863 864 865 878 904 908 910 912 914 917 919 929 930 934 937 941 943 947 948 954 959 973 978 980 984 989",
    C: "205 210 214 217 218 219 224 225 228 251 254 256 262 270 274 281 309 312 314 316 318 319 320 325 327 331 334 337 346 361 364 402 405 409 414 417 430 432 447 464 469 479 501 504 507 512 515 531 534 539 557 563 572 573 580 601 605 608 612 615 618 620 629 630 636 641 651 659 660 662 682 701 708 712 713 715 726 730 731 737 763 769 773 779 785 806 815 816 817 830 832 847 850 870 872 901 903 913 918 920 931 936 938 940 945 952 956 972 975 979 985",
    P: "206 209 213 253 279 310 323 341 350 360 408 415 424 425 442 458 503 509 510 530 541 559 562 564 619 626 628 650 657 661 669 702 707 714 725 747 760 775 805 818 820 831 840 858 909 916 925 949 951 971",
    M: "208 303 307 385 406 435 505 575 719 720 801 915 970 983 986",
    A: "480 520 602 623 928",
    H: "808",
    K: "907",
  };
  const out: Record<string, string> = {};
  for (const [k, list] of Object.entries(codes)) for (const c of list.split(" ")) out[c] = z[k];
  return out;
})();

/** Time zone from a US phone number's area code, for contacts with no location on file. */
export function timeZoneForPhone(phone: string): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d.length === 10 ? d : "";
  return ten ? AREA[ten.slice(0, 3)] ?? null : null;
}

export type CallWindow = "good" | "ok" | "late";
/** good = before or after the work day (owners are off the job), ok = during the day, late = too early or too late to call. */
export function localCallInfo(location: string, now: Date, phone = ""): { time: string; window: CallWindow } | null {
  const tz = timeZoneFor(location) ?? timeZoneForPhone(phone);
  if (!tz) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  const h = Number(get("hour")) % 24, m = Number(get("minute"));
  const mins = h * 60 + m;
  const weekend = /Sat|Sun/.test(get("weekday"));
  const window: CallWindow = mins < 7 * 60 || mins >= 19 * 60 ? "late" : !weekend && (mins < 8 * 60 + 30 || mins >= 16 * 60 + 30) ? "good" : "ok";
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(now);
  return { time, window };
}
