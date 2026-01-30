#target photoshop
app.bringToFront();

(function () {
    if (!app.documents.length) {
        alert("Abra um documento antes de rodar o script.");
        return;
    }

    var doc = app.activeDocument;

    // ===== CONFIGURAÇÕES FIXAS (conforme pedido) =====
    // Verticais
    var marginX = 80;     // margem esquerda/direita (px)
    var gutter  = 160;    // gutter entre colunas (px) -> guia no meio também

    // Horizontais
    var marginY = 144;    // margem superior/inferior (px)
    // ================================================

    // ---------- ScriptUI: pedir quantidade de colunas + checkbox ----------
    function showDialog(defaultColumns, defaultClearGuides) {
        var w = new Window("dialog", "Gerar guias (colunas)");
        w.alignChildren = "fill";

        var g = w.add("group");
        g.add("statictext", undefined, "Quantidade de colunas:");
        var input = g.add("edittext", undefined, String(defaultColumns));
        input.characters = 6;

        var chk = w.add("checkbox", undefined, "Remover guias existentes");
        chk.value = !!defaultClearGuides;

        var hint = w.add("statictext", undefined, "Use um inteiro ≥ 1.");
        hint.graphics.font = ScriptUI.newFont(hint.graphics.font.name, "ITALIC", hint.graphics.font.size);

        var buttons = w.add("group");
        buttons.alignment = "right";
        var ok = buttons.add("button", undefined, "OK");
        var cancel = buttons.add("button", undefined, "Cancelar");

        function sanitizeAndValidate() {
            var t = input.text.replace(/[^\d]/g, "");
            input.text = t;

            if (!t.length) return { ok: false, value: null };

            var n = parseInt(t, 10);
            if (isNaN(n) || n < 1) return { ok: false, value: null };

            return { ok: true, value: n };
        }

        input.onChanging = function () {
            var res = sanitizeAndValidate();
            ok.enabled = res.ok;
        };

        input.onKeyDown = function (k) {
            if (k.keyName === "Enter") {
                var res = sanitizeAndValidate();
                if (res.ok) w.close(1);
            }
        };

        ok.enabled = true;
        sanitizeAndValidate();

        ok.onClick = function () {
            var res = sanitizeAndValidate();
            if (!res.ok) {
                alert("Informe um número inteiro de colunas (≥ 1).");
                return;
            }
            w.close(1);
        };

        cancel.onClick = function () { w.close(0); };

        var r = w.show();
        if (r !== 1) return null;

        var finalRes = sanitizeAndValidate();
        if (!finalRes.ok) return null;

        return {
            columns: finalRes.value,
            clearGuides: chk.value === true
        };
    }

    var ui = showDialog(3, false); // defaults: 3 colunas, não remover
    if (ui === null) return;

    var columns = ui.columns;
    var clearExistingGuides = ui.clearGuides;

    // ---------- Utilitários (pixels + guias) ----------
    var originalRulerUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    function addV(x) { doc.guides.add(Direction.VERTICAL, new UnitValue(x, "px")); }
    function addH(y) { doc.guides.add(Direction.HORIZONTAL, new UnitValue(y, "px")); }

    // ---------- Lock Guides: garantir estado ----------
    function getGuidesLockedState() {
        // Tenta ler o estado "checked" do menu View > Lock Guides (toggleLockGuides)
        // Se não conseguir, retorna null.
        try {
            var s2t = function (s) { return app.stringIDToTypeID(s); };

            var ref = new ActionReference();
            ref.putEnumerated(s2t("menuItemClass"), s2t("menuItemType"), s2t("toggleLockGuides"));

            var desc = executeActionGet(ref);
            // Em muitos menus, o estado vem em "checked"
            if (desc.hasKey(s2t("checked"))) {
                return desc.getBoolean(s2t("checked"));
            }
        } catch (e) { /* ignora */ }

        return null;
    }

    function toggleLockGuides() {
        // Toggle do menu "Lock Guides"
        app.runMenuItem(app.stringIDToTypeID("toggleLockGuides"));
    }

    function ensureGuidesLocked(shouldBeLocked) {
        var state = getGuidesLockedState();

        if (state === null) {
            // Fallback: não dá pra ler estado -> aplica toggle apenas quando necessário por tentativa
            // Se quiser sempre "bloquear no final", a chamada aqui no final é suficiente na maioria dos fluxos.
            if (shouldBeLocked) toggleLockGuides();
            return;
        }

        if (state !== shouldBeLocked) {
            toggleLockGuides();
        }
    }

    function unlockIfLockedForRemoval() {
        var state = getGuidesLockedState();
        if (state === true) {
            toggleLockGuides(); // desbloqueia para permitir remover guias
            return true; // estava bloqueado
        }
        if (state === null) {
            // Tenta remover; se falhar, toggle e tenta de novo (ver abaixo)
            return null;
        }
        return false; // já estava desbloqueado
    }

    // ---------- Execução ----------
    var relockAfter = false; // se precisarmos desbloquear para remover, vamos relockar ao final

    try {
        if (clearExistingGuides) {
            var unlockedByUs = unlockIfLockedForRemoval();

            if (unlockedByUs === true) {
                relockAfter = true;
                doc.guides.removeAll();
            } else if (unlockedByUs === false) {
                doc.guides.removeAll();
            } else {
                // Estado desconhecido: tenta remover, se falhar, toggle e tenta de novo
                try {
                    doc.guides.removeAll();
                } catch (e1) {
                    try {
                        toggleLockGuides();   // provavelmente desbloqueia
                        relockAfter = true;   // vamos garantir lock depois
                        doc.guides.removeAll();
                    } catch (e2) {
                        throw e2;
                    }
                }
            }
        }

        var docW = doc.width.as("px");
        var docH = doc.height.as("px");

        // =========================
        // GUIAS VERTICAIS
        // =========================

        // Guias no começo e no fim do documento
        addV(0);
        addV(docW);

        // Guias de margens
        if (marginX > 0) {
            if (marginX * 2 >= docW) throw new Error("Margem X inválida: não sobra largura útil.");
            addV(marginX);
            addV(docW - marginX);
        }

        // Se for 1 coluna, não há gutters/colunas internas
        if (columns > 1) {
            var usableW = docW - (marginX * 2);
            var totalGutters = gutter * (columns - 1);

            if (totalGutters >= usableW) {
                throw new Error(
                    "Não cabe: gutter total (" + totalGutters + "px) >= área útil (" + usableW + "px).\n" +
                    "Reduza o número de colunas ou ajuste gutter/margens."
                );
            }

            var colW = (usableW - totalGutters) / columns;

            // Colunas + gutters + guia no meio do gutter
            var x = marginX; // início da 1ª coluna (já tem guia na margem)
            for (var i = 1; i < columns; i++) {
                x += colW;          // fim da coluna atual (início do gutter)
                addV(x);

                addV(x + gutter/2); // guia no meio do gutter

                x += gutter;        // fim do gutter (início da próxima coluna)
                addV(x);
            }
        }

        // =========================
        // GUIAS HORIZONTAIS
        // =========================

        // Guias no começo e no fim do documento
        addH(0);
        addH(docH);

        // Guias de margens superior/inferior
        if (marginY > 0) {
            if (marginY * 2 >= docH) throw new Error("Margem Y inválida: não sobra altura útil.");
            addH(marginY);
            addH(docH - marginY);
        }

        // =========================
        // BLOQUEAR GUIAS NO FINAL
        // =========================
        // Se desbloqueamos para remover, vamos relockar com certeza.
        // Se não, ainda assim garantimos lock no final.
        ensureGuidesLocked(true);

        alert("✅ Guias adicionadas e Bloqueadas!");

    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        app.preferences.rulerUnits = originalRulerUnits;
    }
})();
