#!/usr/bin/env python3
"""Chiffre le jeton GitHub de l'admin avec le mot de passe d'accès.

Le résultat (une ligne base64) se colle dans JETON_CHIFFRE de admin/index.html.

    /usr/bin/python3 scripts/chiffre_jeton.py <motdepasse> <jeton>

Format : base64( sel 16 octets | iv 12 octets | AES-256-GCM(jeton) + tag )
La clé est dérivée du mot de passe (minuscules) par PBKDF2-SHA256,
310 000 itérations, en miroir exact du déchiffrement WebCrypto du navigateur.
Nécessite le paquet `cryptography` (présent avec le python3 système).
"""

import base64
import hashlib
import os
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage : /usr/bin/python3 scripts/chiffre_jeton.py <motdepasse> <jeton>")
    mdp = sys.argv[1].strip().lower()
    jeton = sys.argv[2].strip()
    if not mdp or not jeton:
        sys.exit("mot de passe et jeton requis")

    sel = os.urandom(16)
    iv = os.urandom(12)
    cle = hashlib.pbkdf2_hmac("sha256", mdp.encode(), sel, 310_000, dklen=32)
    chiffre = AESGCM(cle).encrypt(iv, jeton.encode(), None)  # ciphertext + tag

    print(base64.b64encode(sel + iv + chiffre).decode())


if __name__ == "__main__":
    main()
