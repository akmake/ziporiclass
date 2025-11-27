#!/usr/bin/env python3
"""
scan_lan.py – סריקה מהירה של כל המכשירים ברשת-LAN המקומית.

תלויויות:
1.  nmap   – יש להתקין במחשב (https://nmap.org/download.html)
2.  Python 3.x (אין ספריות ניח החצד שלישי – רק stdlib)

הפעלה:
    python scan_lan.py
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import xml.etree.ElementTree as ET


# -----------------------------------------------------------
#  כלי עזר: איתור כתובת IP מקומית והסקת טווח CIDR סביר
# -----------------------------------------------------------
def get_local_ip() -> str:
    """מחזיר את כתובת IP של המחשב ברשת המקומית."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        # "מתחבר" ל-8.8.8.8 כדי שה-OS יבחר ממשק רשת פעיל
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]


def guess_cidr(ip: str) -> str:
    """
    גוזר טווח CIDR מה-IP:
      * ‎10.x.x.x  → ‎10.0.0.0/8
      * ‎172.x.y.z → ‎172.x.0.0/16
      * אחרת (לרוב ‎192.168.x.y) → ‎192.168.x.0/24
    """
    octets = ip.split(".")
    if ip.startswith("10."):
        return "10.0.0.0/8"
    if ip.startswith("172."):
        return f"{octets[0]}.{octets[1]}.0.0/16"
    # ברירת-מחדל – /24
    return f"{octets[0]}.{octets[1]}.{octets[2]}.0/24"


# -----------------------------------------------------------
#  סריקת Nmap ו-XML Parsing
# -----------------------------------------------------------
def run_nmap(network: str) -> str:
    """מריץ nmap‎-sn ומחזיר את פלט-XML כ-string."""
    nmap_bin = shutil.which("nmap")
    if not nmap_bin:
        sys.exit("❌  nmap לא מותקן או לא נמצא ב-PATH – התקן והרץ שוב.")
    cmd = [nmap_bin, "-sn", network, "-oX", "-"]  # STDOUT ⇒ XML
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"❌  nmap נכשל ({res.returncode}):\n{res.stderr}")
    return res.stdout


def parse_nmap_xml(xml_data: str) -> list[dict]:
    """מפענח את ה-XML ומחזיר רשימת dict-ים: ip, mac, vendor."""
    hosts = []
    root = ET.fromstring(xml_data)
    for host in root.findall("host"):
        if host.findtext("status/@state", default="down") != "up":
            continue
        ip_elem  = host.find("address[@addrtype='ipv4']")
        mac_elem = host.find("address[@addrtype='mac']")
        hosts.append({
            "ip": ip_elem.attrib["addr"] if ip_elem is not None else None,
            "mac": mac_elem.attrib.get("addr") if mac_elem is not None else None,
            "vendor": mac_elem.attrib.get("vendor") if mac_elem is not None else None,
        })
    return hosts


# -----------------------------------------------------------
#  main – הגיון ראשי
# -----------------------------------------------------------
def main() -> None:
    local_ip = get_local_ip()
    cidr     = guess_cidr(local_ip)
    print(f"🔍  מזהה רשת: {cidr}  (המחשב: {local_ip})")
    xml_out  = run_nmap(cidr)
    devices  = parse_nmap_xml(xml_out)

    if not devices:
        print("לא נמצאו מכשירים (אולי כולם כבויים / חסומים-Ping).")
        return

    print("\n📋  מכשירים מחוברים:")
    for dev in devices:
        vendor = f" ({dev['vendor']})" if dev["vendor"] else ""
        print(f" • {dev['ip']:15}  {dev['mac'] or '---':17}{vendor}")

    # אפשר גם לייצא JSON לשימוש בתוכנה אחרת:
    # with open("lan_devices.json", "w", encoding="utf-8") as f:
    #     json.dump(devices, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
