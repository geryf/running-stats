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
	}
}
