// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import { h, render, Component } from 'preact'
import {observable, computed, asFlat} from 'mobx'
import Bounds from './Bounds'
import type {SVGElement} from './Util'
import Layout from './Layout'
import NoData from './NoData'
import Observations from './Observations'
window.Observations = Observations

export type SlopeChartSeries = {
	label: string,
	key: string,
	color: string,
	size: number,
	values: { x: number, y: number }[]
};

type AxisProps = {
	bounds: Bounds,
	orient: 'left' | 'right' | 'bottom',
	tickFormat: (number) => string,
	scale: any
};

class Axis extends Component {
	static calculateBounds(containerBounds : Bounds, props : any) {
		const {orient, scale} = props

//		if (orient == 'left' || orient == 'right') {
			const longestTick = _.sortBy(scale.ticks(6), (tick) => -tick.length)[0]
			return new Bounds(containerBounds.x, containerBounds.y, Bounds.forText(longestTick).width, containerBounds.height)
//		} else {
//			return new Bounds(containerBounds.x, containerBounds.y, 0, containerBounds.height)
//		}
	}

	props: AxisProps

	render() {
		const { bounds, scale, orient, tickFormat } = this.props
		const ticks = scale.ticks(6)
		const textColor = '#666'

		return <g className="axis" font-size="0.8em">
					{_.map(ticks, (tick) => {
						if (orient == 'left' || orient == 'right')
							return <text x={orient == 'left' ? bounds.left : bounds.right} y={scale(tick)} fill={textColor} dominant-baseline="middle" text-anchor={orient == 'left' ? 'start' : 'end'}>{tickFormat(tick)}</text>
						else if (orient == 'top' || orient == 'bottom')
							return <text x={scale(tick)} y={orient == 'top' ? bounds.top : bounds.bottom} fill={textColor} dominant-baseline={orient == 'top' ? 'auto' : 'hanging'} text-anchor="middle">{tickFormat(tick)}</text>
					})}
  			    </g>		
	}
}
class AligningText extends Component {
	textNode: SVGElement

	render() {
		return <text ref={(node) => this.textNode = node} {...this.props}>{this.props.children}</text>
	}

	componentDidMount() {
		this.componentDidUpdate()
	}

	componentDidUpdate() {
		d3.select(this.textNode).attr('dy', this.textNode.getBBox().height/4)		
	}
}

/*class AxisLayout {
	xAxes: AxisConfig[]
	yAxes: AxisConfig[]
	innerScales: Scales
	bounds: Bounds
	innerBounds: Bounds

	constructor(axes: AxisConfig[], bounds: Bounds, options: { yDomainDefault?: [number, number], xDomainDefault?: [number, number] }) {
		const { xDomainDefault, yDomainDefault } = options

		const xAxes = _.filter(axes, (axis) => axis.orient == 'top' || axis.orient == 'bottom')
		const yAxes = _.filter(axes, (axis) => axis.orient == 'left' || axis.orient == 'right')

		const xScaleType = xAxes.length ? xAxes[0].scaleType : 'linear'
		const yScaleType = yAxes.length ? yAxes[0].scaleType : 'linear'

		let xScale = xScaleType == 'log' ? d3.scaleLog() : d3.scaleLinear()
		let yScale = yScaleType == 'log' ? d3.scaleLog() : d3.scaleLinear()

		xScale = xScale.domain(_.extend([], xDomainDefault, xAxes.length > 0 && xAxes[0].domain))
		yScale = yScale.domain(_.extend([], yDomainDefault, yAxes.length > 0 && yAxes[0].domain))

		let innerBounds = bounds	
		_.each(yAxes, (axis) => {
			const width = this.getAxisWidth(yScale, axis)
			if (axis.orient == 'left')
				innerBounds = innerBounds.padLeft(width)
			else if (axis.orient == 'right')
				innerBounds = innerBounds.padRight(width)
		})

		_.each(xAxes, (axis) => {
			const height = this.getAxisHeight(xScale, axis)
			if (axis.orient == 'top')
				innerBounds = innerBounds.padLeft(height)
			else if (axis.orient == 'bottom')
				innerBounds = innerBounds.padRight(height)
		})

		xScale = xScale.range([innerBounds.left, innerBounds.right])
		yScale = yScale.range([innerBounds.bottom, innerBounds.top])

		this.xAxes = xAxes
		this.yAxes = yAxes
		this.innerScales = new Scales(xScale, yScale)
		this.innerBounds = innerBounds
	}

	getAxisWidth(yScale, yAxis : AxisConfig) {
		const ticks = _.map(yScale.ticks(), yAxis.tickFormat)
		const longestLabel = _.sortBy(ticks, (tick) => {
			return -yAxis.tickFormat(tick).length
		})[0]
		return Bounds.forText(longestLabel, { fontSize: '0.8em' }).width
	}

	getAxisHeight(xScale, xAxis : AxisConfig) {
		const ticks = _.map(xScale.ticks(), xAxis.tickFormat)
		const longestLabel = _.sortBy(ticks, (tick) => {
			return -xAxis.tickFormat(tick).length
		})[0]
		return Bounds.forText(longestLabel).height
	}
}*/

class Gridlines extends Component {
	props: {
		axisLayout: AxisLayout
	}

	render() {
		const { axisLayout } = this.props
		const { innerBounds, innerScales } = axisLayout	
		const { yScale } = innerScales
		const [ x1, x2 ] = [ innerBounds.left, innerBounds.right ]
		const ticks = yScale.ticks()

		return <g class="gridlines">
			{_.map(ticks, (tick) => {
				return <line x1={x1} y1={yScale(tick)} x2={x2} y2={yScale(tick)} stroke="#eee" stroke-dasharray="3,2"/>
			})}
		</g>
	}
}

export class SlopeChart extends Component {
	props: {
		bounds: Bounds,
		data: SlopeChartSeries[],
		yDomain: [number, number],
		yTickFormat: (number) => string,
		yScaleType: 'log' | 'linear'
	}

	state: {
		focusKey: ?string
	}

	g: SVGElement
	svg: SVGElement

	@observable props = asFlat({})
	@observable state = asFlat({})

	@computed get bounds() : Bounds {
		return this.props.bounds
	}

	@computed get isPortrait() : boolean {
		return this.bounds.height > this.bounds.width
	}

	@computed get xDomainDefault() : [number, number] {
		return d3.extent(_.pluck(_.flatten(_.pluck(this.props.data, 'values')), 'x'))
	}

	@computed get yDomainDefault() : [number, number] {
		return d3.extent(_.pluck(_.flatten(_.pluck(this.props.data, 'values')), 'y'))
	}

	@computed get xDomain() : [number, number] {
		return this.xDomainDefault
	}

	@computed get yDomain() : [number, number] {
		return _.extend([], this.yDomainDefault, this.props.yDomain)
	}

	@computed get sizeScale() : any {
		return d3.scaleLinear().domain(d3.extent(_.pluck(this.props.data, 'size'))).range([1, 3])
	}

	@computed get yScaleConstructor() : any {
		return this.props.yScaleType == 'log' ? d3.scaleLog : d3.scaleLinear
	}

	@computed get yScale() : any {
		return this.yScaleConstructor().domain(this.yDomain).range(this.props.bounds.padBottom(50).yRange())
	}

	@computed get xScale() : any {
		const {bounds, isPortrait, xDomain, yScale} = this
		const padding = isPortrait ? 0 : Axis.calculateBounds(bounds, { orient: 'left', scale: yScale }).width*2
		return d3.scaleLinear().domain(xDomain).range(bounds.padWidth(padding).xRange())
	}

	@computed get initialSlopeData() : SlopeProps[] {
		const { data, yTickFormat } = this.props
		const { bounds, isPortrait, xScale, yScale, sizeScale } = this

		const slopeData : SlopeProps[] = []
		const yDomain = yScale.domain()

		_.each(data, (series) => {
			// Ensure values fit inside the chart
			if (!_.every(series.values, (d) => d.y >= yDomain[0] && d.y <= yDomain[1]))
				return;

			const [ v1, v2 ] = series.values
			const [ x1, x2 ] = [ xScale(v1.x), xScale(v2.x) ]
			const [ y1, y2 ] = [ yScale(v1.y), yScale(v2.y) ]
			const leftLabel = series.label + ' ' + yTickFormat(v1.y)
			const rightLabel = yTickFormat(v2.y) + ' ' + series.label
			const fontSize = (isPortrait ? 0.4 : 0.6)*(leftLabel.length > 25 ? 0.7 : 1) + 'em'
			const leftLabelBounds = Bounds.forText(leftLabel, { fontSize: fontSize })
			const rightLabelBounds = Bounds.forText(rightLabel, { fontSize: fontSize })

			slopeData.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: series.color,
							 size: sizeScale(series.size)||1,
							 leftLabel: leftLabel, rightLabel: rightLabel,
							 leftLabelBounds: leftLabelBounds, rightLabelBounds: rightLabelBounds,
							 labelFontSize: fontSize, key: series.key, isFocused: false,
							 hasLeftLabel: true, hasRightLabel: true })
		})

		return slopeData
	}

	// We calc max before doing overlaps because visible labels may change later but
	// layout should remain constant
	@computed get maxLabelWidth() : number {
		return _.max(_.map(this.initialSlopeData, (slope) => slope.leftLabelBounds.width))		
	}

	// Get the final slope data with hover focusing and collision detection
	@computed get slopeData() : SlopeProps[] {
		const { maxLabelWidth } = this
		const { focusKey } = this.state		
		let slopeData = this.initialSlopeData

		// Position lines and labels to account for each other
		_.each(slopeData, (slope) => {
			slope.isFocused = slope.key == focusKey
			slope.x1 += maxLabelWidth
			slope.x2 -= maxLabelWidth
			slope.leftLabelBounds = slope.leftLabelBounds.extend({ x: slope.x1-8-slope.leftLabelBounds.width, y: slope.y1+slope.leftLabelBounds.height/4 })
			slope.rightLabelBounds = slope.rightLabelBounds.extend({ x: slope.x2+8, y: slope.y2+slope.rightLabelBounds.height/4 })		
		})

		// Eliminate overlapping labels, one pass for each side
		_.each(slopeData, (s1) => {
			_.each(slopeData, (s2) => {
				let hasPriority = true
				if (!s1.isFocused && s2.isFocused)
					hasPriority = false
				else if (s1.size < s2.size)
					hasPriority = false

				if (s1 !== s2 && s1.hasLeftLabel && s2.hasLeftLabel && hasPriority) {
					if (s1.leftLabelBounds.intersects(s2.leftLabelBounds))
						s2.hasLeftLabel = false
				}
			})
		})

		_.each(slopeData, (s1) => {
			_.each(slopeData, (s2) => {
				let hasPriority = true
				if (!s1.isFocused && s2.isFocused)
					hasPriority = false
				else if (s1.size < s2.size)
					hasPriority = false
				else if (!s1.hasLeftLabel && s2.hasLeftLabel)
					hasPriority = false

				if (s1 !== s2 && s1.hasRightLabel && s2.hasRightLabel && hasPriority) {
					if (s1.rightLabelBounds.intersects(s2.rightLabelBounds))
						s2.hasRightLabel = false
				}
			})
		})

		// Order by focus and size for draw order
		slopeData = _.sortBy(slopeData, (slope) => slope.size)
		slopeData = _.sortBy(slopeData, (slope) => slope.isFocused ? 1 : 0)

		return slopeData		
	}

	componentDidMount() {
		this.svg = this.g.parentNode

		d3.select(this.svg).on('mousemove.slopechart', () => {
			const mouse = d3.mouse(this.g)
			if (this.props.bounds.containsPoint(...mouse)) {
				const slope = _.sortBy(this.slopeData, (slope) => {
					const distToLine = Math.abs((slope.y2-slope.y1)*mouse[0] - (slope.x2-slope.x1)*mouse[1] + slope.x2*slope.y1 - slope.y2*slope.x1) / Math.sqrt((slope.y2-slope.y1)**2 + (slope.x2-slope.x1)**2)
					return distToLine
				})[0]
				this.setState({ focusKey: slope.key })
			} else {
				this.setState({ focusKey: null })				
			}

		})
	}

	componentDidUnmount() {
		d3.select(this.svg).on('mousemove.slopechart', null)
	}

    render() {
    	const { yTickFormat, bounds } = this.props
    	const { slopeData, isPortrait, xDomain, xScale, yScale } = this

    	if (_.isEmpty(slopeData))
    		return <NoData bounds={bounds}/>

	    return (
	    	<g class="slopeChart" ref={(g) => this.g = g}>
	    		{/*<Gridlines axisLayout={axisLayout}/>*/}	    		
	    		{ !isPortrait ? <Axis orient='left' tickFormat={yTickFormat} scale={yScale} bounds={bounds}/> : '' }
	    		{ !isPortrait ? <Axis orient='right' tickFormat={yTickFormat} scale={yScale} bounds={bounds}/> : '' }
				<g class="slopes">
					{_.map(slopeData, (slope) => {
				    	return <Slope {...slope} />
			    	})}	
				</g>
	    		<text x={slopeData[0].x1} y={yScale.range()[0]+10} text-anchor="middle" dominant-baseline="hanging" fill="#666">{xDomain[0]}</text>
	    		<text x={slopeData[0].x2} y={yScale.range()[0]+10} text-anchor="middle" dominant-baseline="hanging" fill="#666">{xDomain[1]}</text>
	    		{/*<line x1={slopeBounds.left} y1={slopeBounds.top} x2={slopeBounds.left} y2={slopeBounds.bottom} stroke="black"/>
	    		<line x1={slopeBounds.right} y1={slopeBounds.top} x2={slopeBounds.right} y2={slopeBounds.bottom} stroke="black"/>*/}
		    </g>
	    );
	}
}

type SlopeProps = {
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: string,
	size: number,
	hasLeftLabel: boolean,
	hasRightLabel: boolean,
	leftLabel: string,
	rightLabel: string,
	labelFontSize: string,
	leftLabelBounds: Bounds,
	rightLabelBounds: Bounds,
	isFocused: boolean
};
	
class Slope extends Component {
	props: SlopeProps

	render() {
		const { x1, y1, x2, y2, color, size, hasLeftLabel, hasRightLabel, leftLabel, rightLabel, labelFontSize, leftLabelBounds, rightLabelBounds, isFocused } = this.props
		const lineColor = color //'#89C9CF'
		const labelColor = '#333'
		const opacity = isFocused ? 1 : 0.7

		return <g>
			{ hasLeftLabel ? <text x={leftLabelBounds.x+leftLabelBounds.width} y={leftLabelBounds.y} text-anchor="end" font-size={labelFontSize} fill={labelColor} font-weight={isFocused&&'bold'}>{leftLabel}</text> : '' }
			<circle cx={x1} cy={y1} r={isFocused ? 6 : 3} fill={lineColor} opacity={opacity}/>
			<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} stroke-width={isFocused ? 2*size : size} opacity={opacity}/>
			<circle cx={x2} cy={y2} r={isFocused ? 6 : 3} fill={lineColor} opacity={opacity}/>
			{ hasRightLabel ? <text x={rightLabelBounds.x} y={rightLabelBounds.y} font-size={labelFontSize} fill={labelColor} font-weight={isFocused&&'bold'}>{rightLabel}</text> : '' }
		</g>
	}
}