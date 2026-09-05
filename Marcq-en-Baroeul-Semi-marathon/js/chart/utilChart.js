var utilChart = {
	/**
	 * Convert a string containing a time in format hh:mm:ss to a number of
	 * minutes
	 * 
	 * @param {string}
	 *            time hh:mm:ss
	 * @returns {Number}
	 */
	isoTimeToMinute : function(time) {
		var dateArray = time.split(':');
		return parseInt(dateArray[0]) * 60 + parseInt(dateArray[1])
				+ Math.round(parseInt(dateArray[2]) / 60);
	},
        isoTimeFormat: function(time) {
            let timeArray = time.split(':');
            let h = parseInt(timeArray[0]);
            return h + 'h ' + timeArray[1] + '\' ' + timeArray[2] + '\'\'';
        },
	/**
	 * Format minutes to a string containing h and minutes
	 */
	minutesToHMin : function(min)
	{
	    if (min > 59){
	    	let m = min%60;
	    	return parseInt(min/60)+'h' + ((m < 10)?'0':'') + m;
	    }
	    return min + '\'';
	},
	/**
	 * Formate une durée en minutes (décimales) pour un axe de temps :
	 * « 1h06'12 » au-delà d'une heure, « 52'30 » en deçà. Avec avecSecondes à
	 * false, les secondes sont omises (« 1h06 », « 52' »).
	 *
	 * @param {number}  min          durée en minutes, éventuellement décimale
	 * @param {boolean} avecSecondes conserver les secondes (défaut : oui)
	 */
	minutesToHMinSec : function(min, avecSecondes)
	{
	    var total = Math.round(min * 60);
	    var h = Math.floor(total / 3600);
	    var m = Math.floor((total % 3600) / 60);
	    var s = total % 60;
	    var pad = function(n) { return (n < 10 ? '0' : '') + n; };
	    if (avecSecondes === false) {
	        return (h > 0) ? (h + 'h' + pad(m)) : (m + '\'');
	    }
	    return (h > 0) ? (h + 'h' + pad(m) + "'" + pad(s)) : (m + "'" + pad(s));
	},
	/**
	 * Pas de graduation d'un axe de temps, choisi parmi des durées rondes pour
	 * que les libellés tombent sur des valeurs lisibles (et non sur des
	 * fractions de minute). Au plus six intervalles sur l'étendue de la série.
	 *
	 * @param  {number[]} secondes valeurs de la série, en secondes
	 * @return {number|undefined}  pas en minutes ; undefined = laisser Chart.js décider
	 */
	tempsAxisStepMinutes : function(secondes)
	{
	    var valeurs = (secondes || []).filter(function(v) {
	        return typeof v === 'number' && isFinite(v);
	    });
	    if (valeurs.length < 2) {
	        return undefined;
	    }
	    var etendue = Math.max.apply(null, valeurs) - Math.min.apply(null, valeurs);
	    if (etendue <= 0) {
	        return undefined;
	    }
	    var pas = [5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600];
	    for (var i = 0; i < pas.length; i++) {
	        if (etendue / pas[i] <= 6) {
	            return pas[i] / 60;
	        }
	    }
	    return undefined;
	},
	/**
	 * Options `ticks` d'un axe Chart.js portant des temps exprimés en minutes.
	 * Arrondir les graduations à la minute produisait des libellés en double
	 * (« 66 66 ») dès que la série tenait dans quelques secondes : le pas est
	 * donc calé sur une durée ronde, et les secondes n'apparaissent que si le
	 * pas est inférieur à la minute.
	 *
	 * @param {number[]} secondes valeurs de la série, en secondes
	 */
	tempsAxisTicks : function(secondes)
	{
	    var pas = utilChart.tempsAxisStepMinutes(secondes);
	    var avecSecondes = !(pas && Math.abs(pas - Math.round(pas)) < 1e-9);
	    return {
	        stepSize: pas,
	        callback: function(v) { return utilChart.minutesToHMinSec(v, avecSecondes); }
	    };
	},
	/**
	 * Comme tempsAxisTicks, mais à partir de séries Chart.js dont les données
	 * sont exprimées en minutes (les points absents sont ignorés).
	 *
	 * @param {object[]} datasets séries Chart.js
	 */
	tempsAxisTicksSeries : function(datasets)
	{
	    var secondes = [];
	    (datasets || []).forEach(function(ds) {
	        (ds.data || []).forEach(function(v) {
	            if (typeof v === 'number' && isFinite(v)) {
	                secondes.push(v * 60);
	            }
	        });
	    });
	    return utilChart.tempsAxisTicks(secondes);
	},
	/**
	 * Vide entièrement un conteneur SVG de graphique (utilisé avant de
	 * reconstruire un graphique D3, par ex. lors d'un redimensionnement de
	 * la fenêtre, pour éviter d'empiler un nouveau <g> par-dessus l'ancien).
	 *
	 * @param {string} containerId
	 */
	clearChart : function(containerId)
	{
	    d3.select('#' + containerId).selectAll('*').remove();
	},
	/**
	 * Retourne une version "debounced" de fn : les appels rapprochés sont
	 * regroupés et fn n'est exécutée qu'une fois, delay ms après le dernier appel.
	 *
	 * @param {Function} fn
	 * @param {Number} delay
	 * @returns {Function}
	 */
	debounce : function(fn, delay)
	{
	    var timeout;
	    return function() {
	        clearTimeout(timeout);
	        timeout = setTimeout(fn, delay);
	    };
	},
	/* --- Étiquettes de dates en abscisse (Chart.js) -------------------------
	 *
	 * Chart.js ne sait pas mettre en gras une partie seulement d'un libellé de
	 * graduation : les dates sont donc dessinées à la main (dateTickLabelsPlugin),
	 * l'ANNÉE sur sa propre ligne, en gras et plus grande. Les libellés natifs
	 * sont vidés (dateTickBlankTicks) et la hauteur de l'axe est réservée par
	 * dateTickAfterFit.
	 */
	DATE_TICK_TOP : 7,
	/**
	 * Découpe un libellé d'abscisse en lignes à dessiner. Le libellé peut être
	 * une chaîne (« 18 mai 2025 ») ou un tableau de lignes (« 18 mai 2025 » +
	 * heure de départ). L'année finale de chaque ligne est isolée.
	 *
	 * @param {string|Array} label
	 * @returns {Array} [{texte, font, hauteur}, ...]
	 */
	dateTickLines : function(label)
	{
	    var lignes = [];
	    (Array.isArray(label) ? label : [label]).forEach(function(part) {
	        var mots = String(part).trim().split(/\s+/);
	        var annee = /^\d{4}$/.test(mots[mots.length - 1]) ? mots.pop() : '';
	        if (mots.length > 0 && mots.join('') !== '') {
	            lignes.push({ texte: mots.join(' '), font: '13px Helvetica, Arial, sans-serif', hauteur: 15 });
	        }
	        if (annee !== '') {
	            lignes.push({ texte: annee, font: 'bold 16px Helvetica, Arial, sans-serif', hauteur: 18 });
	        }
	    });
	    return lignes;
	},
	/**
	 * Callback de graduation qui vide le libellé natif : la place est reprise
	 * par dateTickLabelsPlugin.
	 */
	dateTickBlankTicks : function()
	{
	    return '';
	},
	/**
	 * afterFit de l'axe X : réserve sous l'axe la hauteur des lignes dessinées.
	 *
	 * @param {Object} scale
	 */
	dateTickAfterFit : function(scale)
	{
	    var labels = (scale.chart && scale.chart.data && scale.chart.data.labels) || [];
	    var max = 0;
	    labels.forEach(function(label) {
	        var h = 0;
	        utilChart.dateTickLines(label).forEach(function(l) { h += l.hauteur; });
	        if (h > max) { max = h; }
	    });
	    scale.height = utilChart.DATE_TICK_TOP + max + 4;
	},
	/**
	 * Plugin Chart.js « inline » : dessine les dates sous l'axe X, année en gras
	 * sur sa propre ligne. À ajouter au tableau `plugins` du graphique, avec
	 * `ticks.callback = utilChart.dateTickBlankTicks` et
	 * `afterFit = utilChart.dateTickAfterFit` sur l'axe X.
	 */
	dateTickLabelsPlugin : {
	    id: 'dateTickLabels',
	    afterDraw: function(chart) {
	        var xScale = chart.scales.x;
	        if (!xScale || !chart.data || !chart.data.labels) { return; }
	        var ctx = chart.ctx;
	        ctx.save();
	        ctx.textAlign = 'center';
	        ctx.textBaseline = 'top';
	        ctx.fillStyle = '#666';
	        chart.data.labels.forEach(function(label, i) {
	            var x = xScale.getPixelForTick(i);
	            var y = xScale.top + utilChart.DATE_TICK_TOP;
	            utilChart.dateTickLines(label).forEach(function(ligne) {
	                ctx.font = ligne.font;
	                ctx.fillText(ligne.texte, x, y);
	                y += ligne.hauteur;
	            });
	        });
	        ctx.restore();
	    }
	}
}
